'use strict';

const prisma       = require('../config/prisma');
const cache        = require('../cache');
const { withTimeout } = require('../utils/timeout');
const { success }  = require('../common/response');
const anthropic    = require('../services/ai/AnthropicService');
const gemini       = require('../services/ai/GeminiService');
const aggregator   = require('../services/analytics/AnalyticsAggregator');

// ── Helpers ───────────────────────────────────────────────────────────────────

function startOfWeek() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d;
}

function timeAgo(date) {
  const secs = Math.floor((Date.now() - new Date(date)) / 1000);
  if (secs < 60)    return 'just now';
  if (secs < 3600)  return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ── Sub-queries (run in parallel) ─────────────────────────────────────────────

async function getAdStats(teamId) {
  const [total, thisWeek] = await Promise.all([
    prisma.ad.count({ where: { campaign: { teamId } } }),
    prisma.ad.count({ where: { campaign: { teamId }, createdAt: { gte: startOfWeek() } } }),
  ]);
  return { total, thisWeek };
}

async function getKeywordStats(teamId) {
  const keywords = await prisma.keyword.findMany({
    where: { teamId, isActive: true },
    select: { id: true, keyword: true, currentRank: true, previousRank: true, searchVolume: true },
    take: 30,
  });

  const withTrend = keywords.map(k => {
    const change = k.previousRank && k.currentRank ? k.previousRank - k.currentRank : 0;
    const trend = change > 2 ? 'rising' : change < -2 ? 'falling' : 'stable';
    return { ...k, trend, change };
  });

  const rising = withTrend.filter(k => k.trend === 'rising').length;
  const trending = withTrend
    .filter(k => k.trend === 'rising')
    .slice(0, 3)
    .map(k => ({ keyword: k.keyword, change: k.change, trend: 'rising' }));

  return { total: keywords.length, rising, trending, items: withTrend };
}

async function getCompetitorStats(teamId) {
  const competitors = await prisma.competitor.findMany({
    where: { teamId },
    select: { id: true, domain: true, name: true, createdAt: true },
    take: 20,
  });
  const newThisWeek = competitors.filter(c => new Date(c.createdAt) >= startOfWeek()).length;
  return { total: competitors.length, newThisWeek, items: competitors };
}

async function getAlertStats(teamId) {
  const [total, unread] = await Promise.all([
    prisma.notification.count({ where: { teamId, type: 'ALERT' } }),
    prisma.notification.count({ where: { teamId, type: 'ALERT', status: 'pending' } }),
  ]);
  return { total, urgent: unread };
}

async function getActivityFeed(teamId) {
  const notifications = await prisma.notification.findMany({
    where: { teamId },
    orderBy: { createdAt: 'desc' },
    take: 6,
    select: { id: true, message: true, type: true, createdAt: true, status: true },
  });
  return notifications.map(n => ({
    id:      n.id,
    message: n.message.replace(/\s*\[rule:[^\]]+\]/g, '').trim(),
    type:    n.type,
    timeAgo: timeAgo(n.createdAt),
    unread:  n.status === 'pending',
  }));
}

// ── Action Item Generator ─────────────────────────────────────────────────────

const FALLBACK_ACTIONS = [
  {
    priority: 'HIGH',
    title: 'Add your first competitor',
    description: 'Track a competitor to get keyword gaps and strategic insights.',
    cta: 'Add Competitor',
    ctaUrl: '/research',
  },
  {
    priority: 'MEDIUM',
    title: 'Research trending keywords',
    description: 'Find keywords rising in your niche before competitors do.',
    cta: 'Research',
    ctaUrl: '/research',
  },
];

async function generateActionItems({ keywords, competitors, alerts }) {
  const context = [];

  const rising = (keywords?.items || []).filter(k => k.trend === 'rising').slice(0, 3);
  for (const kw of rising) {
    context.push(`Keyword "${kw.keyword}" is trending upward`);
  }

  if (competitors?.total > 0) {
    context.push(`You are tracking ${competitors.total} competitor(s)`);
  }

  if (alerts?.urgent > 0) {
    context.push(`${alerts.urgent} unread campaign alert(s) need attention`);
  }

  if (context.length === 0) return FALLBACK_ACTIONS;

  const prompt = `You are an ad strategy advisor. Based on these signals, generate 2-3 specific, actionable recommendations for a campaign manager. Each action should save real time or money.

Signals:
${context.join('\n')}

Return ONLY valid JSON array (no markdown):
[{
  "priority": "HIGH",
  "title": "short action title (max 8 words)",
  "description": "one sentence explaining why this matters",
  "cta": "button label (max 3 words)",
  "ctaUrl": "/relevant-route"
}]`;

  try {
    let parsed = null;
    if (anthropic.isAvailable) {
      parsed = await anthropic.generateJSON(prompt, {
        timeoutMs: 6000,
        temperature: 0.15,
        cacheKey: `dashboard-actions:${context.join('|')}`,
        cacheTtlSeconds: 15 * 60,
      });
    }
    if (!parsed && gemini.isAvailable) {
      let raw = null;
      raw = await withTimeout(gemini.generate(prompt), 6000).catch(() => null);
      if (raw) {
        const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
        parsed = JSON.parse(cleaned);
      }
    }
    return Array.isArray(parsed) && parsed.length ? parsed : FALLBACK_ACTIONS;
  } catch {
    return FALLBACK_ACTIONS;
  }
}

// ── GET /api/v1/dashboard/metrics ─────────────────────────────────────────────

exports.getMetrics = async (req, res, next) => {
  const start = Date.now();
  try {
    const { teamId } = req.user;
    const cacheKey = `dashboard:metrics:${teamId}`;
    const cached = cache.get(cacheKey);
    if (cached) return success(res, { ...cached, meta: { cached: true, responseTime: Date.now() - start } });

    const [adStats, keywordStats, competitorStats, alertStats, activity] =
      await Promise.allSettled([
        getAdStats(teamId),
        getKeywordStats(teamId),
        getCompetitorStats(teamId),
        getAlertStats(teamId),
        getActivityFeed(teamId),
      ]);

    const ads        = adStats.status        === 'fulfilled' ? adStats.value        : { total: 0, thisWeek: 0 };
    const keywords   = keywordStats.status   === 'fulfilled' ? keywordStats.value   : { total: 0, rising: 0, trending: [], items: [] };
    const competitors = competitorStats.status === 'fulfilled' ? competitorStats.value : { total: 0, newThisWeek: 0 };
    const alerts     = alertStats.status     === 'fulfilled' ? alertStats.value     : { total: 0, urgent: 0 };
    const feed       = activity.status       === 'fulfilled' ? activity.value       : [];

    // Health score 0-100 based on engagement
    const healthScore = Math.min(100,
      (ads.total > 0 ? 25 : 0) +
      (keywords.total > 0 ? 25 : 0) +
      (competitors.total > 0 ? 25 : 0) +
      (feed.length > 0 ? 25 : 0)
    );
    const healthLabel = healthScore >= 75 ? 'Ad Intelligence Ready'
      : healthScore >= 50 ? 'Getting Started'
      : 'Set Up Your Account';

    // AI action items — non-blocking; return fallback if AI takes > 3 s
    const actionItems = await Promise.race([
      generateActionItems({ keywords, competitors, alerts }),
      new Promise(resolve => setTimeout(() => resolve(FALLBACK_ACTIONS), 3000)),
    ]);

    const result = {
      health: { score: healthScore, label: healthLabel },
      stats: {
        adsCreated:  { value: ads.total,          delta: ads.thisWeek,          deltaLabel: 'this week',  label: 'Ads Created' },
        keywords:    { value: keywords.total,      delta: keywords.rising,       deltaLabel: 'rising',    label: 'Keywords' },
        competitors: { value: competitors.total,   delta: competitors.newThisWeek, deltaLabel: 'new',     label: 'Competitors' },
        alerts:      { value: alerts.total,        urgent: alerts.urgent,         label: 'Active Alerts' },
      },
      actionItems,
      activityFeed: feed,
      keywordTrends: keywords.trending,
      demoMode: true, // no real integrations yet
    };

    cache.set(cacheKey, result, 120); // 2min cache
    return success(res, { ...result, meta: { cached: false, responseTime: Date.now() - start } });
  } catch (err) { next(err); }
};

// ── GET /api/v1/dashboard/health-score ────────────────────────────────────────

exports.getHealthScore = async (req, res, next) => {
  try {
    const { teamId } = req.user;
    const cacheKey = `dashboard:health:${teamId}`;
    const cached = cache.get(cacheKey);
    if (cached) return success(res, { ...cached, cached: true });

    // Reuse analytics aggregator — already computes ROAS/CTR/CPA health
    const overview = await aggregator.getOverview(teamId, '30d');
    const { health, actions, avgROAS, overallCTR, overallCPA, activeCampaigns, totalCampaigns } = overview;

    // AI verdict — cached 30 min, skipped if no signals
    let aiVerdict = null;
    const verdictKey = `dashboard:health:verdict:${teamId}`;
    const cachedVerdict = cache.get(verdictKey);

    if (cachedVerdict) {
      aiVerdict = cachedVerdict;
    } else if (actions.length > 0) {
      const verdictPrompt = `You are an ad performance expert. Give a 1-sentence verdict on account health and the single most important action to take now.

Health score: ${health.score}/100 (${health.label})
Issues: ${actions.map(a => a.message).join('; ')}
ROAS: ${avgROAS}x | CTR: ${overallCTR}% | CPA: $${overallCPA}
Active campaigns: ${activeCampaigns}/${totalCampaigns}

Return ONLY a JSON object: {"verdict": "...", "topAction": "..."}`;

      try {
        if (anthropic.isAvailable) {
          aiVerdict = await anthropic.generateJSON(verdictPrompt, {
            timeoutMs: 5000,
            temperature: 0.1,
            cacheKey: `dashboard-verdict:${teamId}:${health.score}:${avgROAS}:${overallCTR}:${overallCPA}:${activeCampaigns}:${totalCampaigns}:${actions.map((a) => a.message).join('|')}`,
            cacheTtlSeconds: 30 * 60,
          });
        }
        if (!aiVerdict && gemini.isAvailable) {
          const raw = await withTimeout(gemini.generate(verdictPrompt), 5000).catch(() => null);
          if (raw) {
            const cleaned = raw.replace(/```json?\s*/gi, '').replace(/```/g, '').trim();
            aiVerdict = JSON.parse(cleaned);
          }
        }
        if (aiVerdict) {
          cache.set(verdictKey, aiVerdict, 1800); // 30min
        }
      } catch { /* non-critical */ }
    }

    const result = {
      score:           health.score,
      label:           health.label,
      actionRequired:  health.actionRequired,
      issues:          actions,
      metrics:         { avgROAS, overallCTR, overallCPA, activeCampaigns, totalCampaigns },
      aiVerdict,
    };

    cache.set(cacheKey, result, 300); // 5min
    return success(res, { ...result, cached: false });
  } catch (err) { next(err); }
};

// ── GET /api/v1/dashboard/recommendations ─────────────────────────────────────

exports.getRecommendations = async (req, res, next) => {
  try {
    const { teamId } = req.user;
    const cacheKey = `dashboard:recs:${teamId}`;
    const cached = cache.get(cacheKey);
    if (cached) return success(res, { recommendations: cached, cached: true });

    const [overview, keywords, alerts] = await Promise.all([
      aggregator.getOverview(teamId, '30d'),
      prisma.keyword.findMany({
        where: { teamId, isActive: true },
        select: { keyword: true, currentRank: true, previousRank: true },
        take: 10,
      }),
      prisma.notification.count({ where: { teamId, type: 'ALERT', status: 'pending' } }),
    ]);

    // Rule-based recommendations
    const recs = [];

    if (overview.avgROAS < 1.0) {
      recs.push({ priority: 'CRITICAL', title: 'Pause Losing Campaigns', description: 'Average ROAS is below 1.0x — you\'re spending more than you earn. Pause underperformers immediately.', cta: 'View Campaigns', ctaUrl: '/campaigns', action: 'pause_campaigns' });
    } else if (overview.avgROAS > 4.0) {
      recs.push({ priority: 'HIGH', title: 'Scale Top Performers', description: `Average ROAS is ${overview.avgROAS}x — excellent. Increase budget on best campaigns to grow revenue.`, cta: 'Scale Now', ctaUrl: '/scaling', action: 'scale_campaigns' });
    }

    if (overview.overallCTR < 0.5) {
      recs.push({ priority: 'HIGH', title: 'Refresh Ad Creatives', description: 'CTR below 0.5% signals ad fatigue. Generate new angles with the AI Ad Studio.', cta: 'Create Ads', ctaUrl: '/ads', action: 'generate_ads' });
    }

    const droppingKeywords = keywords.filter(k => k.previousRank && k.currentRank && k.currentRank > k.previousRank + 5);
    if (droppingKeywords.length > 0) {
      recs.push({ priority: 'MEDIUM', title: 'Investigate Ranking Drops', description: `${droppingKeywords.length} keyword(s) dropped significantly. Check for algorithm changes or new competitors.`, cta: 'View Keywords', ctaUrl: '/research', action: 'check_keywords' });
    }

    if (alerts > 0) {
      recs.push({ priority: 'HIGH', title: `${alerts} Unread Alert${alerts > 1 ? 's' : ''}`, description: 'Budget and performance alerts need your attention.', cta: 'Review Alerts', ctaUrl: '/pulse', action: 'review_alerts' });
    }

    if (recs.length === 0) {
      recs.push({ priority: 'LOW', title: 'Add More Competitors', description: 'Track 3+ competitors to unlock keyword gap analysis and counter-strategies.', cta: 'Add Competitor', ctaUrl: '/research', action: 'add_competitor' });
      recs.push({ priority: 'LOW', title: 'Run an SEO Audit', description: 'Audit your site to find technical issues hurting organic rankings.', cta: 'Audit Site', ctaUrl: '/seo', action: 'seo_audit' });
    }

    cache.set(cacheKey, recs, 900); // 15min
    return success(res, { recommendations: recs, cached: false });
  } catch (err) { next(err); }
};
