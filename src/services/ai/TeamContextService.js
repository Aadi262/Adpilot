'use strict';

const prisma = require('../../config/prisma');

class TeamContextService {
  async getKeywordContext(teamId, keyword) {
    const tokens = this._tokens(keyword);
    const [keywords, briefs, audits, reports] = await Promise.all([
      prisma.keyword.findMany({
        where: { teamId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          keyword: true,
          currentRank: true,
          previousRank: true,
          searchVolume: true,
          difficulty: true,
          trackedUrl: true,
          lastCheckedAt: true,
        },
      }),
      prisma.contentBrief.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          targetKeyword: true,
          title: true,
          searchIntent: true,
          uniqueAngle: true,
          createdAt: true,
        },
      }),
      prisma.seoAudit.findMany({
        where: { teamId, status: { in: ['completed', 'complete'] } },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          url: true,
          overallScore: true,
          grade: true,
          createdAt: true,
        },
      }),
      prisma.researchReport.findMany({
        where: {
          teamId,
          status: { in: ['market_completed', 'ad_intel_completed'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: {
          query: true,
          status: true,
          createdAt: true,
          adAnalysis: true,
        },
      }),
    ]);

    return {
      matchedKeywords: keywords
        .filter((row) => this._matches(row.keyword, tokens))
        .slice(0, 8)
        .map((row) => ({
          keyword: row.keyword,
          currentRank: row.currentRank,
          previousRank: row.previousRank,
          searchVolume: row.searchVolume,
          difficulty: row.difficulty,
          trackedUrl: row.trackedUrl,
        })),
      matchedBriefs: briefs
        .filter((row) => this._matches(row.targetKeyword, tokens))
        .slice(0, 5)
        .map((row) => ({
          keyword: row.targetKeyword,
          title: row.title,
          searchIntent: row.searchIntent,
          uniqueAngle: row.uniqueAngle,
          createdAt: row.createdAt,
        })),
      recentAudits: audits.slice(0, 4).map((row) => ({
        url: row.url,
        score: row.overallScore,
        grade: row.grade,
        createdAt: row.createdAt,
      })),
      relatedResearch: reports
        .filter((row) => this._matches(row.query, tokens) || this._reportMentions(row.adAnalysis, tokens))
        .slice(0, 4)
        .map((row) => ({
          query: row.query,
          kind: row.status,
          createdAt: row.createdAt,
          summary: this._summarizeResearch(row.adAnalysis),
        })),
    };
  }

  async getCompetitorContext(teamId, domain) {
    const cleanDomain = this._normalizeDomain(domain);
    const [competitor, keywords, reports, briefs, audits] = await Promise.all([
      prisma.competitor.findFirst({
        where: { teamId, domain: cleanDomain },
        select: {
          domain: true,
          topKeywords: true,
          lastScrapedAt: true,
        },
      }),
      prisma.keyword.findMany({
        where: { teamId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          keyword: true,
          currentRank: true,
          previousRank: true,
          searchVolume: true,
          trackedUrl: true,
        },
      }),
      prisma.researchReport.findMany({
        where: {
          teamId,
          status: { in: ['market_completed', 'ad_intel_completed'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          query: true,
          status: true,
          createdAt: true,
          adAnalysis: true,
        },
      }),
      prisma.contentBrief.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          targetKeyword: true,
          title: true,
          searchIntent: true,
          createdAt: true,
        },
      }),
      prisma.seoAudit.findMany({
        where: { teamId, status: { in: ['completed', 'complete'] } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          url: true,
          overallScore: true,
          grade: true,
          createdAt: true,
        },
      }),
    ]);

    const competitorKeywords = Array.isArray(competitor?.topKeywords)
      ? competitor.topKeywords
          .map((row) => String(row.keyword || row.word || '').trim().toLowerCase())
          .filter(Boolean)
      : [];
    const keywordSet = new Set(competitorKeywords);

    return {
      competitor: competitor
        ? {
            domain: competitor.domain,
            topKeywords: competitorKeywords.slice(0, 8),
            lastScrapedAt: competitor.lastScrapedAt,
          }
        : null,
      trackedKeywordOverlap: keywords
        .filter((row) => keywordSet.has(String(row.keyword || '').trim().toLowerCase()))
        .slice(0, 8)
        .map((row) => ({
          keyword: row.keyword,
          currentRank: row.currentRank,
          previousRank: row.previousRank,
          searchVolume: row.searchVolume,
        })),
      topOwnedKeywords: keywords
        .filter((row) => row.currentRank != null)
        .sort((a, b) => (a.currentRank || 999) - (b.currentRank || 999))
        .slice(0, 8)
        .map((row) => ({
          keyword: row.keyword,
          currentRank: row.currentRank,
          previousRank: row.previousRank,
          searchVolume: row.searchVolume,
        })),
      priorResearch: reports
        .filter((row) => this._normalizeDomain(row.query) === cleanDomain || this._reportMatchesDomain(row.adAnalysis, cleanDomain))
        .slice(0, 4)
        .map((row) => ({
          query: row.query,
          kind: row.status,
          createdAt: row.createdAt,
          summary: this._summarizeResearch(row.adAnalysis),
        })),
      recentBriefs: briefs.slice(0, 4).map((row) => ({
        keyword: row.targetKeyword,
        title: row.title,
        searchIntent: row.searchIntent,
      })),
      recentAudits: audits.slice(0, 4).map((row) => ({
        url: row.url,
        score: row.overallScore,
        grade: row.grade,
      })),
    };
  }

  async getReportContext(teamId) {
    const [briefs, reports, audits, keywords] = await Promise.all([
      prisma.contentBrief.findMany({
        where: { teamId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { targetKeyword: true, title: true, createdAt: true },
      }),
      prisma.researchReport.findMany({
        where: {
          teamId,
          status: { in: ['market_completed', 'ad_intel_completed'] },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { query: true, status: true, createdAt: true, adAnalysis: true },
      }),
      prisma.seoAudit.findMany({
        where: { teamId, status: { in: ['completed', 'complete'] } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { url: true, overallScore: true, grade: true, createdAt: true },
      }),
      prisma.keyword.findMany({
        where: { teamId, isActive: true },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { keyword: true, currentRank: true, previousRank: true, searchVolume: true },
      }),
    ]);

    return {
      recentBriefs: briefs,
      recentResearch: reports.map((row) => ({
        query: row.query,
        kind: row.status,
        summary: this._summarizeResearch(row.adAnalysis),
      })),
      recentAudits: audits,
      trackedKeywords: keywords,
    };
  }

  formatKeywordContext(context) {
    const lines = ['TEAM MEMORY:'];

    if (context.matchedKeywords?.length) {
      lines.push('Tracked keywords already related to this topic:');
      context.matchedKeywords.forEach((row) => {
        lines.push(`- ${row.keyword} | rank=${row.currentRank ?? 'n/a'} | prev=${row.previousRank ?? 'n/a'} | volume=${row.searchVolume ?? 'n/a'} | difficulty=${row.difficulty ?? 'n/a'}`);
      });
    }

    if (context.matchedBriefs?.length) {
      lines.push('Existing briefs on adjacent topics:');
      context.matchedBriefs.forEach((row) => {
        lines.push(`- ${row.keyword} | title="${row.title}" | intent=${row.searchIntent || 'unknown'} | uniqueAngle=${row.uniqueAngle || 'n/a'}`);
      });
    }

    if (context.relatedResearch?.length) {
      lines.push('Recent research touching this topic:');
      context.relatedResearch.forEach((row) => {
        lines.push(`- ${row.kind} for ${row.query}: ${row.summary}`);
      });
    }

    if (context.recentAudits?.length) {
      lines.push('Recent SEO audits for this team:');
      context.recentAudits.forEach((row) => {
        lines.push(`- ${row.url} | score=${row.score ?? 'n/a'} | grade=${row.grade ?? 'n/a'}`);
      });
    }

    return lines.join('\n');
  }

  formatCompetitorContext(context) {
    const lines = ['TEAM MEMORY:'];

    if (context.competitor?.topKeywords?.length) {
      lines.push(`Stored competitor keywords for ${context.competitor.domain}:`);
      context.competitor.topKeywords.forEach((keyword) => lines.push(`- ${keyword}`));
    }

    if (context.trackedKeywordOverlap?.length) {
      lines.push('Your tracked keyword overlap with this competitor:');
      context.trackedKeywordOverlap.forEach((row) => {
        lines.push(`- ${row.keyword} | your_rank=${row.currentRank ?? 'n/a'} | prev_rank=${row.previousRank ?? 'n/a'} | volume=${row.searchVolume ?? 'n/a'}`);
      });
    }

    if (context.topOwnedKeywords?.length) {
      lines.push('Your strongest currently tracked keywords:');
      context.topOwnedKeywords.forEach((row) => {
        lines.push(`- ${row.keyword} | your_rank=${row.currentRank ?? 'n/a'} | prev_rank=${row.previousRank ?? 'n/a'} | volume=${row.searchVolume ?? 'n/a'}`);
      });
    }

    if (context.priorResearch?.length) {
      lines.push('Prior research on this competitor/domain:');
      context.priorResearch.forEach((row) => {
        lines.push(`- ${row.kind} for ${row.query}: ${row.summary}`);
      });
    }

    if (context.recentBriefs?.length) {
      lines.push('Recent content briefs for this team:');
      context.recentBriefs.forEach((row) => {
        lines.push(`- ${row.keyword} | intent=${row.searchIntent || 'unknown'} | title="${row.title}"`);
      });
    }

    return lines.join('\n');
  }

  formatReportContext(context) {
    const lines = ['TEAM MEMORY:'];

    if (context.trackedKeywords?.length) {
      lines.push('Tracked keywords snapshot:');
      context.trackedKeywords.forEach((row) => {
        lines.push(`- ${row.keyword} | rank=${row.currentRank ?? 'n/a'} | prev=${row.previousRank ?? 'n/a'} | volume=${row.searchVolume ?? 'n/a'}`);
      });
    }

    if (context.recentBriefs?.length) {
      lines.push('Recent content output planned:');
      context.recentBriefs.forEach((row) => {
        lines.push(`- ${row.targetKeyword} | "${row.title}"`);
      });
    }

    if (context.recentResearch?.length) {
      lines.push('Recent research work:');
      context.recentResearch.forEach((row) => {
        lines.push(`- ${row.kind} for ${row.query}: ${row.summary}`);
      });
    }

    if (context.recentAudits?.length) {
      lines.push('Recent SEO audit snapshot:');
      context.recentAudits.forEach((row) => {
        lines.push(`- ${row.url} | score=${row.overallScore ?? 'n/a'} | grade=${row.grade ?? 'n/a'}`);
      });
    }

    return lines.join('\n');
  }

  _tokens(value) {
    return String(value || '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((token) => token.length >= 3);
  }

  _matches(value, tokens) {
    if (!tokens?.length) return false;
    const haystack = String(value || '').toLowerCase();
    return tokens.some((token) => haystack.includes(token));
  }

  _reportMentions(adAnalysis, tokens) {
    if (!adAnalysis || !tokens?.length) return false;
    const blob = JSON.stringify(adAnalysis).toLowerCase();
    return tokens.some((token) => blob.includes(token));
  }

  _reportMatchesDomain(adAnalysis, domain) {
    if (!adAnalysis || !domain) return false;
    return this._normalizeDomain(adAnalysis.domain || adAnalysis.url || '') === domain;
  }

  _summarizeResearch(adAnalysis) {
    if (!adAnalysis || typeof adAnalysis !== 'object') return 'no summary available';
    if (Array.isArray(adAnalysis.attackVectors) && adAnalysis.attackVectors[0]?.title) return adAnalysis.attackVectors[0].title;
    if (Array.isArray(adAnalysis.winbackOpportunities) && adAnalysis.winbackOpportunities[0]?.suggestedHeadline) return adAnalysis.winbackOpportunities[0].suggestedHeadline;
    if (adAnalysis.title) return adAnalysis.title;
    if (adAnalysis.domain) return `analysis for ${adAnalysis.domain}`;
    return 'analysis saved';
  }

  _normalizeDomain(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (!raw) return '';
    return raw.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
  }
}

module.exports = new TeamContextService();
