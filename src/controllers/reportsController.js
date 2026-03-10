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
          select: { keyword: true, currentRank: true, previousRank: true, searchVolume: true, difficulty: true },
          take: 20,
        }),
        prisma.competitor.findMany({
          where: { teamId },
          select: { domain: true, name: true, createdAt: true, topKeywords: true },
          take: 10,
        }),
        prisma.seoAudit.findMany({
          where: { teamId, createdAt: { gte: since } },
          select: {
            url: true,
            overallScore: true,
            status: true,
            createdAt: true,
            issues: true,
            categoryScores: true,
            summary: true,
          },
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

    const keywordPerformance = kws.map((k) => {
      const position = k.currentRank ?? null;
      const previous = k.previousRank ?? null;
      const change = position != null && previous != null ? previous - position : 0;
      const difficulty = k.difficulty ?? null;
      const intent = thisInferIntent(k.keyword);
      const trend = change > 0 ? 'rising' : change < 0 ? 'falling' : 'stable';
      const opportunity = calculateOpportunity({
        volume: k.searchVolume,
        difficulty,
        position,
        intent,
      });
      return {
        keyword: k.keyword,
        volume: k.searchVolume || null,
        position,
        previousPosition: previous,
        change,
        difficulty,
        intent,
        opportunity,
        trend,
        status: classifyKeywordStatus(position, change, opportunity),
      };
    });

    const competitorMatrix = comp.slice(0, 3).map((c) => {
      const topKeywords = Array.isArray(c.topKeywords) ? c.topKeywords : [];
      return {
        competitor: c.domain || c.name,
        estimatedTraffic: null,
        keywordCount: topKeywords.length || null,
        topContent: topKeywords[0]?.keyword || topKeywords[0]?.word || null,
        adSpend: null,
      };
    });

    const contentRecommendations = keywordPerformance
      .sort((a, b) => (b.opportunity || 0) - (a.opportunity || 0))
      .slice(0, 5)
      .map((k) => ({
        topic: buildContentTopic(k.keyword, k.intent),
        targetKeyword: k.keyword,
        estimatedTrafficPotential: k.volume || null,
        difficulty: k.difficulty,
        priority: k.opportunity >= 75 ? 'high' : k.opportunity >= 55 ? 'medium' : 'low',
      }));

    const technicalIssues = seo.flatMap((audit) => normalizeAuditIssues(audit)).slice(0, 12);
    const topOpportunities = buildTopOpportunities({ keywordPerformance, campaignRows, comp, contentRecommendations });
    const topThreats = buildTopThreats({ alertCount, seo, campaignRows, keywordPerformance });
    const actionPlan = buildActionPlan({ technicalIssues, campaignRows, keywordPerformance, comp, seo });
    const executiveSummary = await buildExecutiveSummary({
      range,
      overview: ov,
      alertCount,
      technicalScore,
      contentScore,
      keywordCoverage,
      backlinkProfile,
      topOpportunities,
      topThreats,
      actionPlan,
      seo,
      keywordPerformance,
    });
    const reportMarkdown = buildReportMarkdown({
      range,
      generatedAt: new Date().toISOString(),
      overview: ov,
      executiveSummary,
      seoHealthScore: {
        overall: Math.round((technicalScore + contentScore + keywordCoverage + backlinkProfile) / 4),
        technicalSeo: technicalScore,
        contentQuality: contentScore,
        keywordCoverage,
        backlinkProfile,
      },
      keywordPerformance,
      competitorMatrix,
      contentRecommendations,
      technicalIssues,
      actionPlan,
    });
    const report = {
      range,
      generatedAt: new Date().toISOString(),
      executiveSummary,
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
      keywordPerformance,
      competitorMatrix,
      contentRecommendations,
      technicalIssues,
      actionPlan,
      reportMarkdown,
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

function classifyKeywordStatus(position, change, opportunity) {
  if (position != null && position <= 10) return 'green';
  if ((opportunity || 0) >= 65 || change > 0) return 'yellow';
  return 'red';
}

function calculateOpportunity({ volume, difficulty, position, intent }) {
  const volumeScore = volume ? Math.min(40, Math.round(volume / 150)) : 10;
  const difficultyScore = difficulty != null ? Math.max(0, 30 - Math.round(difficulty / 3.4)) : 15;
  const rankScore = position ? Math.max(0, 20 - Math.min(position, 20)) : 10;
  const intentScore = intent === 'commercial' || intent === 'transactional' ? 10 : 5;
  return Math.max(0, Math.min(100, volumeScore + difficultyScore + rankScore + intentScore));
}

function thisInferIntent(keyword = '') {
  const q = keyword.toLowerCase();
  if (/(buy|price|pricing|cost|agency|service|software|tool|platform|best|top|vs|compare|review)/.test(q)) return 'commercial';
  if (/(template|download|trial|demo|book|hire|get)/.test(q)) return 'transactional';
  if (/(login|docs|documentation|homepage|official)/.test(q)) return 'navigational';
  return 'informational';
}

function normalizeAuditIssues(audit) {
  const issues = Array.isArray(audit.issues) ? audit.issues : [];
  if (!issues.length) {
    return [{
      url: audit.url,
      issue: `Recent audit score: ${audit.overallScore ?? 'N/A'}`,
      severity: audit.overallScore != null && audit.overallScore < 60 ? 'high' : 'medium',
      recommendation: 'Review the latest audit details and resolve the largest score deductions first.',
      createdAt: audit.createdAt,
    }];
  }

  return issues.slice(0, 4).map((issue) => ({
    url: audit.url,
    issue: issue.description || issue.id || 'SEO issue detected',
    severity: String(issue.severity || 'medium').toLowerCase(),
    recommendation: issue.recommendation || 'Investigate and resolve this issue in the audited page template.',
    createdAt: audit.createdAt,
  }));
}

function buildTopOpportunities({ keywordPerformance, campaignRows, comp, contentRecommendations }) {
  const items = [];
  const topKeyword = keywordPerformance.find((row) => (row.opportunity || 0) >= 65);
  if (topKeyword) items.push(`Publish or refresh content for "${topKeyword.keyword}" because it shows ${topKeyword.opportunity}/100 opportunity with ${topKeyword.volume || 'unknown'} monthly searches.`);
  const scalableCampaign = [...campaignRows].sort((a, b) => (b.roas || 0) - (a.roas || 0))[0];
  if (scalableCampaign) items.push(`Scale or duplicate "${scalableCampaign.name}" if its ${scalableCampaign.roas}x ROAS can be sustained with new creative variants.`);
  if (comp[0]) items.push(`Expand competitor benchmarking beyond ${comp[0].domain} to strengthen gap analysis and content targeting.`);
  if (contentRecommendations[0]) items.push(`Use "${contentRecommendations[0].topic}" as the next content brief because it has the strongest current traffic upside.`);
  return items.slice(0, 3);
}

function buildTopThreats({ alertCount, seo, campaignRows, keywordPerformance }) {
  const items = [];
  if (alertCount > 0) items.push(`${alertCount} budget or anomaly alerts fired in this period, which signals active performance instability.`);
  const weakAudit = seo.find((audit) => (audit.overallScore || 0) < 60);
  if (weakAudit) items.push(`${weakAudit.url} scored ${weakAudit.overallScore}, making it the biggest current SEO quality risk.`);
  const weakCampaign = campaignRows.find((row) => row.ctr > 0 && row.ctr < 1);
  if (weakCampaign) items.push(`"${weakCampaign.name}" is under 1% CTR, which usually points to weak message-market fit or creative fatigue.`);
  const fallingKeyword = keywordPerformance.find((row) => row.change < 0);
  if (fallingKeyword) items.push(`"${fallingKeyword.keyword}" lost ranking positions in this range and should be reviewed before traffic decays further.`);
  return items.slice(0, 3);
}

function buildActionPlan({ technicalIssues, campaignRows, keywordPerformance, comp, seo }) {
  const items = [];
  const criticalTech = technicalIssues.find((issue) => issue.severity === 'critical' || issue.severity === 'high');
  if (criticalTech) {
    items.push({
      priority: 'critical',
      title: `Fix ${criticalTech.issue}`,
      detail: `Start with ${criticalTech.url} and apply: ${criticalTech.recommendation}`,
    });
  } else if (seo[0]) {
    items.push({
      priority: 'critical',
      title: 'Resolve the biggest SEO score deductions',
      detail: `Use the latest audit for ${seo[0].url} as the first remediation target.`,
    });
  }

  const weakCampaign = campaignRows.find((row) => row.ctr > 0 && row.ctr < 1.5);
  items.push({
    priority: 'important',
    title: weakCampaign ? `Refresh creative on "${weakCampaign.name}"` : 'Refresh low-performing ad creatives',
    detail: weakCampaign
      ? `Its CTR is ${weakCampaign.ctr}%, so tighten relevance, creative rotation, and CTA clarity.`
      : 'Rotate ad angles, headlines, and CTAs to defend CTR and CPA.',
  });

  const topKeyword = keywordPerformance.find((row) => (row.opportunity || 0) >= 60);
  items.push({
    priority: 'important',
    title: topKeyword ? `Build content for "${topKeyword.keyword}"` : 'Expand keyword coverage',
    detail: topKeyword
      ? `This keyword combines meaningful search demand with a favorable opportunity score of ${topKeyword.opportunity}/100.`
      : 'Track and prioritize more intent-rich keywords to improve visibility reporting.',
  });

  items.push({
    priority: 'nice_to_have',
    title: comp.length < 3 ? 'Track more competitors' : 'Deepen competitor monitoring cadence',
    detail: comp.length < 3
      ? 'Track at least 3 competitors so Radar and Pulse can surface stronger benchmark patterns.'
      : 'Review competitor shifts weekly so attacks and counter-positioning stay current.',
  });

  return items.slice(0, 4);
}

async function buildExecutiveSummary({
  range,
  overview,
  alertCount,
  technicalScore,
  contentScore,
  keywordCoverage,
  backlinkProfile,
  topOpportunities,
  topThreats,
  actionPlan,
  seo,
  keywordPerformance,
}) {
  const deterministic = {
    overview: `Across the last ${range}, the account generated $${overview.totalRevenue || 0} from $${overview.totalAdSpend || 0} in spend, with ${overview.avgROAS || 0}x ROAS and ${overview.totalConversions || 0} tracked conversions. SEO health is currently led by a technical score of ${technicalScore}/100 and keyword coverage of ${keywordCoverage}/100.`,
    findings: `The strongest near-term upside comes from ${topOpportunities[0] || 'better keyword coverage and campaign iteration'}, while the biggest current risk is ${topThreats[0] || 'uneven performance stability across SEO and paid channels'}.`,
    actions: actionPlan.map((item) => item.title),
    topOpportunities,
    topThreats,
  };

  const prompt = `You are generating an executive report summary for a SaaS growth dashboard.

Use ONLY the data below. Do not invent metrics.

Range: ${range}
Spend: ${overview.totalAdSpend || 0}
Revenue: ${overview.totalRevenue || 0}
ROAS: ${overview.avgROAS || 0}
CTR: ${overview.overallCTR || 0}
Conversions: ${overview.totalConversions || 0}
Alerts: ${alertCount}
SEO scores:
- Technical SEO: ${technicalScore}
- Content Quality: ${contentScore}
- Keyword Coverage: ${keywordCoverage}
- Backlink Profile: ${backlinkProfile}

Top opportunities:
${topOpportunities.join('\n') || 'None'}

Top threats:
${topThreats.join('\n') || 'None'}

Recommended actions:
${actionPlan.map((item) => `- [${item.priority}] ${item.title}: ${item.detail}`).join('\n')}

Top keywords:
${keywordPerformance.slice(0, 5).map((row) => `- ${row.keyword}: position=${row.position ?? 'n/a'}, volume=${row.volume ?? 'n/a'}, opportunity=${row.opportunity ?? 'n/a'}, trend=${row.trend}`).join('\n')}

Return JSON only:
{
  "overview": "2-3 sentence plain-English summary",
  "findings": "1 paragraph with biggest upside and biggest risk",
  "recommendedActions": ["action 1", "action 2", "action 3"],
  "topOpportunities": ["...", "...", "..."],
  "topThreats": ["...", "...", "..."]
}`;

  try {
    let raw = null;
    if (anthropic.isAvailable) raw = await withTimeout(anthropic.generate(prompt), 7000).catch(() => null);
    if (!raw && gemini.isAvailable) raw = await withTimeout(gemini.generate(prompt), 7000).catch(() => null);
    if (!raw) return deterministic;
    const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    return {
      overview: parsed.overview || deterministic.overview,
      findings: parsed.findings || deterministic.findings,
      recommendedActions: Array.isArray(parsed.recommendedActions) && parsed.recommendedActions.length ? parsed.recommendedActions.slice(0, 4) : deterministic.actions,
      topOpportunities: Array.isArray(parsed.topOpportunities) && parsed.topOpportunities.length ? parsed.topOpportunities.slice(0, 3) : deterministic.topOpportunities,
      topThreats: Array.isArray(parsed.topThreats) && parsed.topThreats.length ? parsed.topThreats.slice(0, 3) : deterministic.topThreats,
    };
  } catch {
    return deterministic;
  }
}

function buildContentTopic(keyword, intent) {
  if (intent === 'commercial') return `Comparison and buyer guide for ${keyword}`;
  if (intent === 'transactional') return `Landing page or offer page for ${keyword}`;
  if (intent === 'navigational') return `Branded support and conversion content for ${keyword}`;
  return `Practical guide and examples for ${keyword}`;
}

function buildReportMarkdown(report) {
  return [
    `# AdPilot Performance Report`,
    ``,
    `Generated: ${new Date(report.generatedAt).toLocaleString()}`,
    `Range: ${report.range}`,
    ``,
    `## Executive Summary`,
    report.executiveSummary.overview,
    ``,
    report.executiveSummary.findings,
    ``,
    `### Top Opportunities`,
    ...report.executiveSummary.topOpportunities.map((item) => `- ${item}`),
    ``,
    `### Top Threats`,
    ...report.executiveSummary.topThreats.map((item) => `- ${item}`),
    ``,
    `## SEO Health Score`,
    `- Overall: ${report.seoHealthScore.overall}/100`,
    `- Technical SEO: ${report.seoHealthScore.technicalSeo}/100`,
    `- Content Quality: ${report.seoHealthScore.contentQuality}/100`,
    `- Keyword Coverage: ${report.seoHealthScore.keywordCoverage}/100`,
    `- Backlink Profile: ${report.seoHealthScore.backlinkProfile}/100`,
    ``,
    `## Keyword Performance`,
    ...report.keywordPerformance.slice(0, 10).map((row) => `- ${row.keyword}: pos ${row.position ?? 'n/a'}, vol ${row.volume ?? 'n/a'}, opp ${row.opportunity ?? 'n/a'}, trend ${row.trend}`),
    ``,
    `## Action Plan`,
    ...report.actionPlan.map((item) => `- [${item.priority}] ${item.title}: ${item.detail}`),
  ].join('\n');
}
