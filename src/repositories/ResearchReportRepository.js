'use strict';

const prisma = require('../config/prisma');

const REPORT_STATUS = {
  market: 'market_completed',
  adIntel: 'ad_intel_completed',
};

class ResearchReportRepository {
  listCompetitors(teamId) {
    return prisma.competitor.findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findCompetitor(teamId, id) {
    return prisma.competitor.findFirst({
      where: { id, teamId },
    });
  }

  findCompetitorByDomain(teamId, domain) {
    return prisma.competitor.findFirst({
      where: { teamId, domain },
    });
  }

  createCompetitor(teamId, { domain, name }) {
    return prisma.competitor.create({
      data: {
        teamId,
        domain,
        name: name?.trim() || domain,
      },
    });
  }

  deleteCompetitor(id) {
    return prisma.competitor.delete({ where: { id } });
  }

  async saveCompetitorKeywords(teamId, analysis) {
    if (!analysis?.domain) return;

    const topKeywords = (analysis.topKeywords || [])
      .slice(0, 20)
      .map((kw) => ({
        keyword: typeof kw === 'string' ? kw : kw.word || kw.keyword || '',
        rank: typeof kw === 'string' ? null : kw.position ?? kw.rank ?? null,
        rankSource: typeof kw === 'string' ? null : kw.rankSource ?? null,
      }))
      .filter((item) => item.keyword);

    if (!topKeywords.length) return;

    await prisma.competitor.updateMany({
      where: { teamId, domain: analysis.domain },
      data: {
        topKeywords,
        lastScrapedAt: new Date(),
      },
    });
  }

  async saveReport({ teamId, kind, query, analysis }) {
    await this.pruneExpired(teamId);

    return prisma.researchReport.create({
      data: {
        teamId,
        query,
        competitors: [],
        adAnalysis: analysis,
        keywords: Array.isArray(analysis?.topKeywords) ? analysis.topKeywords.slice(0, 20) : [],
        suggestions: Array.isArray(analysis?.keywordGaps) ? analysis.keywordGaps.slice(0, 20) : [],
        status: REPORT_STATUS[kind],
      },
    });
  }

  async getLatestReport(teamId, kind) {
    await this.pruneExpired(teamId);

    return prisma.researchReport.findFirst({
      where: {
        teamId,
        status: REPORT_STATUS[kind],
        createdAt: { gte: this._cutoffDate() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReports(teamId, kind, limit = 10) {
    await this.pruneExpired(teamId);

    return prisma.researchReport.findMany({
      where: {
        teamId,
        status: REPORT_STATUS[kind],
        createdAt: { gte: this._cutoffDate() },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  pruneExpired(teamId) {
    return prisma.researchReport.deleteMany({
      where: {
        teamId,
        status: { in: Object.values(REPORT_STATUS) },
        createdAt: { lt: this._cutoffDate() },
      },
    });
  }

  _cutoffDate() {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }
}

module.exports = {
  researchReportRepository: new ResearchReportRepository(),
  REPORT_STATUS,
};
