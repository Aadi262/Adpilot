'use strict';

const prisma            = require('../../config/prisma');
const { getRedis }      = require('../../config/redis');
const MetricsCalculator = require('../analytics/MetricsCalculator');
const logger            = require('../../config/logger');
const serpService       = require('../keywords/SerpService');

/**
 * Keyword Opportunity Score formula:
 *   score = (searchVolume * CTR_potential) / (difficulty * competition_factor)
 *
 * CTR_potential:      estimated CTR at rank 1 (28%), rank 3 (11%), rank 10 (2.5%)
 * competition_factor: normalized [1..3] from difficulty
 */
const CTR_CURVE = [0, 0.28, 0.20, 0.11, 0.08, 0.06, 0.05, 0.04, 0.03, 0.025, 0.015];

class KeywordTrackingService {
  /**
   * Calculate opportunity score for a single keyword.
   */
  static opportunityScore({ searchVolume, difficulty, currentRank }) {
    const rank             = currentRank || 100;
    const ctrPotential     = rank <= 10 ? (CTR_CURVE[rank] || 0.015) : 0.01;
    const competitionFactor = 1 + (difficulty / 100) * 2; // 1..3
    const score = (searchVolume * ctrPotential) / (difficulty * competitionFactor);
    return parseFloat(score.toFixed(4));
  }

  /**
   * Detect rank changes vs previous values.
   * Uses Exponential Moving Average to smooth noisy rank data.
   */
  static detectRankChange(keyword) {
    const { currentRank, previousRank } = keyword;
    if (currentRank === null || previousRank === null) return { change: 0, trend: 'new', ema: currentRank };

    // EMA with alpha=0.4 to smooth daily fluctuations
    const history = [previousRank, currentRank];
    const ema     = MetricsCalculator.ema(history, 0.4);
    const change  = previousRank - currentRank; // positive = improved ranking

    const trend = change > 3 ? 'rising' : change < -3 ? 'falling' : 'stable';
    return { change, trend, ema: parseFloat(ema.toFixed(1)) };
  }

  /**
   * Fetch all keywords for a team, enriched with opportunity score + rank change.
   * Flattens rankChange into top-level fields (change, trend, ema) for frontend compatibility.
   */
  async getKeywords(teamId, { page = 1, limit = 50 } = {}) {
    const skip = (page - 1) * limit;
    const [keywords, total] = await Promise.all([
      prisma.keyword.findMany({
        where:   { teamId, isActive: true },
        orderBy: { searchVolume: 'desc' },
        skip,
        take:    limit,
      }),
      prisma.keyword.count({ where: { teamId, isActive: true } }),
    ]);

    const enriched = keywords.map((kw) => {
      const rankChange = KeywordTrackingService.detectRankChange(kw);
      return {
        ...kw,
        volume:          kw.searchVolume,          // alias for frontend
        opportunityScore: KeywordTrackingService.opportunityScore(kw),
        rankChange,
        change:          rankChange.change,        // flattened
        trend:           rankChange.trend,
        ema:             rankChange.ema,
      };
    });

    return { items: enriched, total };
  }

  /**
   * Simulate a rank update (in production: call SerpAPI / scraper).
   * Saves previousRank → currentRank rotation and writes a KeywordRank history record.
   */
  async syncRanks(teamId) {
    const keywords = await prisma.keyword.findMany({ where: { teamId, isActive: true } });
    const updates  = [];
    const now      = new Date();

    // Get team's domain from any tracked competitor or use a generic placeholder
    const teamDomain = process.env.TEAM_DOMAIN || 'adpilot.io';

    for (const kw of keywords) {
      let newRank = null;
      let isReal  = false;

      // Try real SERP lookup first
      if (serpService.isAvailable) {
        const serpResult = await serpService.getRank(kw.keyword, teamDomain);
        if (serpResult.isReal) {
          newRank = serpResult.position; // null = not in top 50
          isReal  = true;
        }
      }

      // Fall back to ±3 rank drift simulation if SERP unavailable
      if (!isReal) {
        const drift = Math.round((Math.random() - 0.5) * 6);
        newRank = kw.currentRank ? Math.max(1, kw.currentRank + drift) : null;
      }

      // Atomically update keyword + append rank history snapshot
      await prisma.$transaction([
        prisma.keyword.update({
          where: { id: kw.id },
          data:  { previousRank: kw.currentRank, currentRank: newRank, lastCheckedAt: now },
        }),
        ...(newRank !== null
          ? [prisma.keywordRank.create({ data: { keywordId: kw.id, teamId, rank: newRank, recordedAt: now } })]
          : []),
      ]);

      updates.push({ id: kw.id, keyword: kw.keyword, newRank, drift });
    }

    logger.info('Keyword ranks synced', { teamId, count: updates.length });
    return updates;
  }

  /**
   * Find top keyword opportunities for a team.
   * Returns keywords with score > threshold, sorted desc.
   */
  async getOpportunities(teamId, limit = 10) {
    const cacheKey = `seo:opportunities:${teamId}`;
    const redis    = getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) { /* miss */ }

    const { items } = await this.getKeywords(teamId, { limit: 200 });
    const sorted = items
      .filter((kw) => kw.opportunityScore > 0)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)
      .slice(0, limit);

    try { await redis.setex(cacheKey, 600, JSON.stringify(sorted)); } catch (_) {}
    return sorted;
  }
}

module.exports = new KeywordTrackingService();
