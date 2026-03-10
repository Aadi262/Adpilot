'use strict';

const prisma      = require('../config/prisma');
const cache       = require('../cache');
const { success } = require('../common/response');
const aggregator  = require('../services/analytics/AnalyticsAggregator');
const anthropic   = require('../services/ai/AnthropicService');
const gemini      = require('../services/ai/GeminiService');
const { withTimeout } = require('../utils/timeout');

function rangeToDate(range) {
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d;
}

// ── GET /api/v1/reports/generate?range=7d|30d|90d ─────────────────────────────

exports.generate = async (req, res, next) => {
  try {
    const { teamId } = req.user;
    const range = ['7d', '30d', '90d'].includes(req.query.range) ? req.query.range : '30d';
    const cacheKey = `report:${teamId}:${range}`;

    const cached = cache.get(cacheKey);
    if (cached) return success(res, { ...cached, cached: true });

    const since = rangeToDate(range);

    // Parallel data fetch
    const [overview, campaigns, keywords, competitors, seoAudits, alerts] =
      await Promise.allSettled([
        aggregator.getOverview(teamId, range),
        prisma.campaign.findMany({
          where: { teamId },
          select: {
            id: true, name: true, platform: true, status: true,
            budget: true, performance: true,
            _count: { select: { ads: true } },
          },
        }),
        prisma.keyword.findMany({
          where: { teamId, isActive: true },
          select: { keyword: true, currentRank: true, previousRank: true, searchVolume: true },
          take: 20,
        }),
        prisma.competitor.findMany({
          where: { teamId },
          select: { domain: true, name: true, createdAt: true },
          take: 10,
        }),
        prisma.seoAudit.findMany({
          where: { teamId, createdAt: { gte: since } },
          select: { url: true, overallScore: true, status: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
        prisma.notification.count({ where: { teamId, type: 'ALERT', createdAt: { gte: since } } }),
      ]);

    const ov   = overview.status    === 'fulfilled' ? overview.value    : {};
    const cpgs = campaigns.status   === 'fulfilled' ? campaigns.value   : [];
    const kws  = keywords.status    === 'fulfilled' ? keywords.value    : [];
    const comp = competitors.status === 'fulfilled' ? competitors.value : [];
    const seo  = seoAudits.status   === 'fulfilled' ? seoAudits.value   : [];
    const alertCount = alerts.status === 'fulfilled' ? alerts.value : 0;

    // Build campaign performance rows
    const campaignRows = cpgs.map(c => {
      const p = c.performance || {};
      const spend   = Number(p.spend)   || 0;
      const revenue = Number(p.revenue) || 0;
      const clicks  = Number(p.clicks)  || 0;
      const imps    = Number(p.impressions) || 0;
      const conv    = Number(p.conversions) || 0;
      const roas    = spend > 0 ? parseFloat((revenue / spend).toFixed(2)) : 0;
      const ctr     = imps > 0  ? parseFloat(((clicks / imps) * 100).toFixed(2)) : 0;
      const cpa     = conv > 0  ? parseFloat((spend / conv).toFixed(2)) : 0;
      return { name: c.name, platform: c.platform, status: c.status, budget: Number(c.budget), adsCount: c._count.ads, spend, revenue, roas, ctr, cpa };
    });

    // Keyword highlights
    const risingKws = kws
      .filter(k => k.previousRank && k.currentRank && k.previousRank > k.currentRank)
      .slice(0, 5)
      .map(k => ({ keyword: k.keyword, change: k.previousRank - k.currentRank, rank: k.currentRank }));

    const fallingKws = kws
      .filter(k => k.previousRank && k.currentRank && k.currentRank > k.previousRank)
      .slice(0, 5)
      .map(k => ({ keyword: k.keyword, change: k.previousRank - k.currentRank, rank: k.currentRank }));

    // AI executive summary — non-blocking, 6s timeout
    let summary = null;
    const summaryPrompt = `You are an advertising analyst. Write a concise 3-sentence executive summary of this account's performance for the past ${range}.

Metrics:
- Total ad spend: $${ov.totalAdSpend || 0}
- Total revenue: $${ov.totalRevenue || 0}
- Average ROAS: ${ov.avgROAS || 0}x
- Overall CTR: ${ov.overallCTR || 0}%
- Total conversions: ${ov.totalConversions || 0}
- Active campaigns: ${ov.activeCampaigns || 0}/${ov.totalCampaigns || 0}
- Budget alerts fired: ${alertCount}
- Health score: ${(ov.health || {}).score || 'N/A'}/100

Return ONLY a JSON object: {"summary": "...", "highlight": "best win in one sentence", "warning": "biggest risk in one sentence"}`;

    try {
      let raw = null;
      if (anthropic.isAvailable) raw = await withTimeout(anthropic.generate(summaryPrompt), 6000).catch(() => null);
      if (!raw && gemini.isAvailable) raw = await withTimeout(gemini.generate(summaryPrompt), 6000).catch(() => null);
      if (raw) {
        const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
        summary = JSON.parse(cleaned);
      }
    } catch { /* non-critical */ }

    const technicalScore = seo.length
      ? Math.round(seo.reduce((sum, audit) => sum + (audit.overallScore || 0), 0) / seo.length)
      : 0;
    const contentScore = Math.min(100, Math.round((kws.length / 20) * 100));
    const keywordCoverage = Math.min(100, Math.round((kws.filter((k) => k.currentRank && k.currentRank <= 20).length / Math.max(kws.length || 1, 1)) * 100));
    const backlinkProfile = comp.length > 0 ? 45 : 20;

    const actionPlan = [
      { priority: 'critical', title: 'Fix the highest-impact SEO issues this week', detail: seo[0]?.url ? `Start with ${seo[0].url}` : 'Start with your most recent audited pages' },
      { priority: 'important', title: 'Refresh weak ad creatives this month', detail: campaignRows.some((c) => c.ctr < 1) ? 'At least one campaign is underperforming on CTR.' : 'Keep creative rotation active to defend CTR.' },
      { priority: 'nice_to_have', title: 'Expand competitor tracking coverage', detail: comp.length < 3 ? 'Track at least 3 competitors for a stronger benchmark set.' : 'Use tracked competitors in monthly reviews.' },
    ];

    const report = {
      range,
      generatedAt: new Date().toISOString(),
      executiveSummary: {
        overview: summary?.summary || `Across the last ${range}, the account generated $${ov.totalRevenue || 0} from $${ov.totalAdSpend || 0} in spend with ${ov.avgROAS || 0}x average ROAS.`,
        topOpportunities: [
          kws[0] ? `Improve ranking coverage for "${kws[0].keyword}"` : 'Expand tracked keyword coverage',
          campaignRows[0] ? `Scale or improve "${campaignRows[0].name}" based on current efficiency` : 'Connect more campaign data for stronger optimization',
          comp[0] ? `Benchmark against ${comp[0].domain}` : 'Add at least one competitor benchmark',
        ],
        topThreats: [
          alertCount > 0 ? `${alertCount} alerts fired during this range` : 'Alert volume is low, but anomaly coverage should still be monitored',
          seo[0] ? `Recent SEO score activity centers around ${seo[0].url}` : 'No recent SEO audits were found',
          kws.length === 0 ? 'No tracked keywords are available for visibility reporting' : 'Keyword coverage still has room to expand',
        ],
        recommendedActions: actionPlan.map((item) => item.title),
      },
      seoHealthScore: {
        overall: Math.round((technicalScore + contentScore + keywordCoverage + backlinkProfile) / 4),
        technicalSeo: technicalScore,
        contentQuality: contentScore,
        keywordCoverage,
        backlinkProfile,
      },
      overview: {
        totalSpend:      ov.totalAdSpend      || 0,
        totalRevenue:    ov.totalRevenue      || 0,
        avgROAS:         ov.avgROAS           || 0,
        overallCTR:      ov.overallCTR        || 0,
        totalConversions: ov.totalConversions || 0,
        totalClicks:     ov.totalClicks       || 0,
        totalImpressions: ov.totalImpressions || 0,
        health:          ov.health            || { score: 0, label: 'Unknown' },
        activeCampaigns: ov.activeCampaigns   || 0,
        totalCampaigns:  ov.totalCampaigns    || 0,
      },
      keywordPerformance: kws.map((k) => ({
        keyword: k.keyword,
        volume: k.searchVolume || null,
        position: k.currentRank ?? null,
        difficulty: null,
        opportunity: k.searchVolume ? Math.min(100, Math.round((k.searchVolume / 100) + (k.currentRank ? (100 - k.currentRank) : 20))) : null,
        trend: k.previousRank && k.currentRank ? (k.currentRank < k.previousRank ? 'rising' : k.currentRank > k.previousRank ? 'falling' : 'stable') : 'stable',
      })),
      competitorMatrix: comp.slice(0, 3).map((c) => ({
        competitor: c.domain || c.name,
        estimatedTraffic: null,
        keywordCount: null,
        topContent: null,
        adSpend: null,
      })),
      contentRecommendations: kws.slice(0, 5).map((k, idx) => ({
        topic: `Create or refresh content for ${k.keyword}`,
        targetKeyword: k.keyword,
        estimatedTrafficPotential: k.searchVolume || null,
        difficulty: null,
        priority: idx < 2 ? 'high' : 'medium',
      })),
      technicalIssues: seo.map((audit) => ({
        url: audit.url,
        score: audit.overallScore,
        status: audit.status,
        createdAt: audit.createdAt,
      })),
      actionPlan,
      campaigns:       campaignRows,
      keywords:        { rising: risingKws, falling: fallingKws, total: kws.length },
      competitors:     { total: comp.length, domains: comp.map(c => c.domain || c.name) },
      seoAudits:       seo,
      alertsFired:     alertCount,
      aiSummary:       summary,
    };

    cache.set(cacheKey, report, 600); // 10min
    return success(res, { ...report, cached: false });
  } catch (err) { next(err); }
};
