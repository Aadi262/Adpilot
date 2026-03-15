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
   * Get daily time-series for a team.
   * Reads from CampaignMetricSnapshot, aggregated by date.
   * Falls back to empty array if no snapshots exist yet.
   */
  async getTimeSeries(teamId, range = '30d') {
    const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const snapshots = await prisma.campaignMetricSnapshot.findMany({
      where: { teamId, date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, spend: true, revenue: true, roas: true, clicks: true, conversions: true },
    });

    // Aggregate all campaigns into daily buckets
    const byDate = {};
    for (const s of snapshots) {
      const key = s.date.toISOString().slice(0, 10);
      if (!byDate[key]) byDate[key] = { label: key, spend: 0, revenue: 0, clicks: 0, conversions: 0, _roasSum: 0, _roasCount: 0 };
      byDate[key].spend       += s.spend;
      byDate[key].revenue     += s.revenue;
      byDate[key].clicks      += s.clicks;
      byDate[key].conversions += s.conversions;
      if (s.roas > 0) { byDate[key]._roasSum += s.roas; byDate[key]._roasCount++; }
    }

    return Object.values(byDate).map((d) => ({
      label:       d.label,
      spend:       parseFloat(d.spend.toFixed(2)),
      revenue:     parseFloat(d.revenue.toFixed(2)),
      roas:        d._roasCount ? parseFloat((d._roasSum / d._roasCount).toFixed(2)) : 0,
      clicks:      d.clicks,
      conversions: d.conversions,
    }));
  }

  /**
   * Detect performance anomalies across active campaigns.
   * Uses last 14 CampaignMetricSnapshot rows as the real baseline.
   * Falls back gracefully if no snapshot data exists.
   */
  async detectAnomalies(teamId) {
    const campaigns = await prisma.campaign.findMany({
      where: { teamId, status: 'active' },
      select: { id: true, name: true, performance: true },
    });

    // Fetch last 14 snapshots per campaign in one query
    const allSnapshots = await prisma.campaignMetricSnapshot.findMany({
      where: {
        teamId,
        campaignId: { in: campaigns.map((c) => c.id) },
      },
      orderBy: { date: 'desc' },
      take: campaigns.length * 14,
      select: { campaignId: true, roas: true, cpa: true, ctr: true },
    });

    // Group by campaignId
    const snapshotsByCampaign = {};
    for (const s of allSnapshots) {
      if (!snapshotsByCampaign[s.campaignId]) snapshotsByCampaign[s.campaignId] = [];
      snapshotsByCampaign[s.campaignId].push(s);
    }

    const anomalies = [];
    for (const c of campaigns) {
      const p         = c.performance || {};
      const history14 = snapshotsByCampaign[c.id] || [];

      // Need at least 3 data points for meaningful anomaly detection
      let history;
      if (history14.length >= 3) {
        history = {
          roas: history14.map((s) => s.roas).filter((v) => v > 0),
          cpa:  history14.map((s) => s.cpa).filter((v) => v !== null && v > 0),
          ctr:  history14.map((s) => s.ctr).filter((v) => v > 0),
        };
      } else {
        // No real baseline — skip anomaly detection for this campaign
        continue;
      }

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
