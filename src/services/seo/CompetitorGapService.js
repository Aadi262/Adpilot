'use strict';

const prisma = require('../../config/prisma');

/**
 * Competitor Gap Detection Algorithm
 *
 * Identifies keywords where:
 *   competitor_rank <= 20 AND (we_rank > 50 OR we_rank IS NULL)
 *
 * These are high-value targets the competitor dominates but we miss.
 */
class CompetitorGapService {
  /**
   * Run gap analysis between team keywords and competitor top keywords.
   * @param {string} teamId
   * @param {string} competitorId — optional, if null checks all competitors
   * @returns {{ gaps: object[], opportunities: number }}
   */
  async analyze(teamId, competitorId = null) {
    const [competitors, ourKeywords] = await Promise.all([
      prisma.competitor.findMany({
        where: { teamId, ...(competitorId ? { id: competitorId } : {}) },
      }),
      prisma.keyword.findMany({ where: { teamId } }),
    ]);

    const ourKeywordMap = new Map(
      ourKeywords.map((kw) => [kw.keyword.toLowerCase(), kw])
    );

    const gaps = [];

    for (const competitor of competitors) {
      const topKeywords = Array.isArray(competitor.topKeywords) ? competitor.topKeywords : [];

      for (const competitorKw of topKeywords) {
        const kwText = typeof competitorKw === 'string'
          ? competitorKw
          : competitorKw.keyword;

        const competitorRank = typeof competitorKw === 'object'
          ? (competitorKw.rank || 10)
          : 10; // assume rank 10 if not stored

        const ourEntry = ourKeywordMap.get(kwText.toLowerCase());
        const ourRank  = ourEntry?.currentRank || null;

        const isGap = competitorRank <= 20 && (!ourRank || ourRank > 50);

        if (isGap) {
          gaps.push({
            keyword:        kwText,
            competitorName: competitor.name,
            competitorRank,
            ourRank,
            searchVolume:   ourEntry?.searchVolume || null,
            difficulty:     ourEntry?.difficulty   || null,
            priority: !ourRank ? 'high' : ourRank > 80 ? 'high' : 'medium',
          });
        }
      }
    }

    // Deduplicate by keyword (multiple competitors may share a gap keyword)
    const deduped = Object.values(
      gaps.reduce((acc, g) => {
        const key = g.keyword.toLowerCase();
        if (!acc[key] || acc[key].competitorRank > g.competitorRank) acc[key] = g;
        return acc;
      }, {})
    );

    const message = competitors.length === 0
      ? 'No competitors tracked yet. Add competitors on the Research page to see keyword gaps.'
      : deduped.length === 0
        ? 'No gaps found. Your keyword coverage matches your competitors, or competitors have no top-keyword data yet. Try analyzing a competitor first.'
        : null;

    return {
      gaps: deduped.sort((a, b) => (a.competitorRank - b.competitorRank)),
      opportunities: deduped.length,
      competitorsAnalyzed: competitors.length,
      message,
    };
  }
}

module.exports = new CompetitorGapService();
