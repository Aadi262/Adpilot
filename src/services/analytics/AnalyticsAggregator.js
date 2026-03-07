'use strict';

const prisma            = require('../../config/prisma');
const { getRedis }      = require('../../config/redis');
const MetricsCalculator = require('./MetricsCalculator');
const AnomalyDetector   = require('./AnomalyDetector');
const logger            = require('../../config/logger');

const CACHE_TTL = 300; // 5 minutes

class AnalyticsAggregator {
  /**
   * Get overview metrics for a team, with Redis caching.
   */
  async getOverview(teamId, range = '30d') {
    const cacheKey = `analytics:overview:${teamId}:${range}`;
    const redis = getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { /* cache miss — continue */ }

    const campaigns = await prisma.campaign.findMany({
      where: { teamId },
      select: { id: true, name: true, status: true, budget: true, performance: true },
    });

    const active  = campaigns.filter((c) => c.status === 'active').length;
    const perfs   = campaigns.map((c) => c.performance || {});

    const totalSpend   = perfs.reduce((s, p) => s + (Number(p.spend)  || 0), 0);
    const totalRevenue = perfs.reduce((s, p) => s + (Number(p.revenue) || 0), 0);
    const totalClicks  = perfs.reduce((s, p) => s + (Number(p.clicks)  || 0), 0);
    const totalImps    = perfs.reduce((s, p) => s + (Number(p.impressions) || 0), 0);
    const totalConv    = perfs.reduce((s, p) => s + (Number(p.conversions) || 0), 0);

    const roasValues = perfs.map((p) => Number(p.roas)).filter((v) => v > 0);
    const avgROAS    = roasValues.length ? roasValues.reduce((s, v) => s + v, 0) / roasValues.length : 0;

    const topCampaign = campaigns.reduce((best, c) => {
      const s = Number((c.performance || {}).spend) || 0;
      return s > (Number(((best || {}).performance || {}).spend) || 0) ? c : best;
    }, null);

    // ── Health score (0–100) ───────────────────────────────────────────────────
    const overallCTR = MetricsCalculator.ctr(totalClicks, totalImps);
    const overallCPA = MetricsCalculator.cpa(totalSpend, totalConv);

    let healthScore = 100;
    const actions = [];

    if (avgROAS < 1.0)  { healthScore -= 30; actions.push({ severity: 'critical', message: 'Average ROAS below 1.0x — campaigns are losing money. Pause underperformers.' }); }
    else if (avgROAS < 2.0) { healthScore -= 15; actions.push({ severity: 'warning', message: 'Average ROAS below 2.0x. Review ad creatives and audience targeting.' }); }

    if (overallCTR < 0.5) { healthScore -= 20; actions.push({ severity: 'warning', message: 'CTR is very low (< 0.5%). Refresh ad copy and creative assets.' }); }
    else if (overallCTR < 1.0) { healthScore -= 10; actions.push({ severity: 'info', message: 'CTR below 1% — consider A/B testing headlines.' }); }

    if (active === 0 && campaigns.length > 0) { healthScore -= 20; actions.push({ severity: 'warning', message: 'No active campaigns. Activate at least one campaign to start generating data.' }); }

    if (overallCPA > 100) { healthScore -= 15; actions.push({ severity: 'warning', message: `High CPA ($${overallCPA}) — optimize conversion funnel or reduce bids.` }); }

    healthScore = Math.max(0, Math.min(100, healthScore));
    const healthLabel = healthScore >= 80 ? 'Healthy' : healthScore >= 60 ? 'Fair' : healthScore >= 40 ? 'Needs Attention' : 'Critical';

    const result = {
      totalCampaigns:  campaigns.length,
      activeCampaigns: active,
      totalAdSpend:    parseFloat(totalSpend.toFixed(2)),
      totalRevenue:    parseFloat(totalRevenue.toFixed(2)),
      totalClicks,
      totalImpressions: totalImps,
      totalConversions: totalConv,
      avgROAS:         parseFloat(avgROAS.toFixed(2)),
      overallCPA,
      overallCTR,
      topCampaign:     topCampaign ? { id: topCampaign.id, name: topCampaign.name } : null,
      health: {
        score:          healthScore,
        label:          healthLabel,
        actionRequired: actions.some(a => a.severity === 'critical'),
      },
      actions,
    };

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (_) { /* non-critical */ }

    return result;
  }

  /**
   * Per-campaign performance list with derived metrics.
   */
  async getCampaignPerformance(teamId) {
    const campaigns = await prisma.campaign.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true, name: true, platform: true, status: true,
        budget: true, budgetType: true, performance: true, createdAt: true,
        _count: { select: { ads: true } },
      },
    });

    return campaigns.map((c) => {
      const p = c.performance || {};
      const spend       = Number(p.spend)       || 0;
      const revenue     = Number(p.revenue)     || 0;
      const clicks      = Number(p.clicks)      || 0;
      const impressions = Number(p.impressions) || 0;
      const conversions = Number(p.conversions) || 0;

      return {
        id:          c.id,
        name:        c.name,
        platform:    c.platform,
        status:      c.status,
        budget:      Number(c.budget),
        budgetType:  c.budgetType,
        adsCount:    c._count.ads,
        spend,
        revenue,
        roas:        MetricsCalculator.roas(revenue, spend),
        cpa:         MetricsCalculator.cpa(spend, conversions),
        ctr:         MetricsCalculator.ctr(clicks, impressions),
        clicks,
        impressions,
        conversions,
        createdAt:   c.createdAt,
      };
    });
  }

  /**
   * Detect performance anomalies across active campaigns.
   * Compares last 7-day averages against 30-day baseline (using seeded perf data).
   */
  async detectAnomalies(teamId) {
    const campaigns = await prisma.campaign.findMany({
      where: { teamId, status: 'active' },
      select: { id: true, name: true, performance: true },
    });

    const anomalies = [];
    for (const c of campaigns) {
      const p = c.performance || {};
      // Build simple single-point history from stored performance
      // In production this would read from a time-series table
      const history = {
        roas: [2.5, 3.0, 2.8, 3.2, 2.9],   // mock 5-day baseline
        cpa:  [12, 14, 11, 13, 12],
        ctr:  [2.1, 2.4, 2.0, 2.3, 2.2],
      };
      const current = {
        roas: Number(p.roas) || 0,
        cpa:  MetricsCalculator.cpa(Number(p.spend) || 0, Number(p.conversions) || 1),
        ctr:  MetricsCalculator.ctr(Number(p.clicks) || 0, Number(p.impressions) || 1),
      };
      const detected = AnomalyDetector.scanAll(current, history);
      if (detected.length) {
        anomalies.push({ campaignId: c.id, campaignName: c.name, anomalies: detected });
      }
    }
    return anomalies;
  }

  /** Invalidate cached overview for a team (call after mutations) */
  async invalidateCache(teamId) {
    try {
      const redis = getRedis();
      await Promise.all(['7d', '30d', '90d'].map((r) => redis.del(`analytics:overview:${teamId}:${r}`)));
    } catch (_) { /* non-critical */ }
  }
}

module.exports = new AnalyticsAggregator();
