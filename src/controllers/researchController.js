'use strict';

const prisma                   = require('../config/prisma');
const competitorHijackService  = require('../services/ai/CompetitorHijackService');
const { success, created }     = require('../common/response');
const AppError                  = require('../common/AppError');

const REPORT_STATUS = {
  market: 'market_completed',
  adIntel: 'ad_intel_completed',
};

// ── Competitors CRUD ──────────────────────────────────────────────────────────

// GET /api/v1/competitors
exports.listCompetitors = async (req, res, next) => {
  try {
    const competitors = await prisma.competitor.findMany({
      where:   { teamId: req.user.teamId },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, { competitors });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/competitors
exports.createCompetitor = async (req, res, next) => {
  try {
    const { domain, name } = req.body;
    if (!domain) throw AppError.badRequest('domain is required');

    const clean = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();

    const existing = await prisma.competitor.findFirst({
      where: { teamId: req.user.teamId, domain: clean },
    });
    if (existing) throw AppError.conflict('Competitor already tracked');

    const competitor = await prisma.competitor.create({
      data: {
        teamId: req.user.teamId,
        domain: clean,
        name:   name?.trim() || clean,
      },
    });

    return created(res, { competitor });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/competitors/:id
exports.deleteCompetitor = async (req, res, next) => {
  try {
    const existing = await prisma.competitor.findFirst({
      where: { id: req.params.id, teamId: req.user.teamId },
    });
    if (!existing) throw AppError.notFound('Competitor not found');

    await prisma.competitor.delete({ where: { id: req.params.id } });
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ── Hijack Analysis ───────────────────────────────────────────────────────────

// GET /api/v1/research/hijack-analysis?domain=example.com
exports.hijackAnalysis = async (req, res, next) => {
  try {
    const { domain } = req.query;
    if (!domain) throw AppError.badRequest('domain query param is required');

    const analysis = await competitorHijackService.analyzeCompetitor(domain, req.user.teamId, 'attack');
    // Persist topKeywords back to competitor record (enables Gaps tab)
    await _saveCompetitorKeywords(analysis, req.user.teamId);
    const report = await _saveResearchReport({
      teamId: req.user.teamId,
      kind: 'adIntel',
      query: domain,
      analysis,
    });
    return success(res, { ...analysis, reportId: report.id, savedAt: report.createdAt });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/competitors/analyze   { url: "https://competitor.com" }
exports.analyzeUrl = async (req, res, next) => {
  try {
    const { url } = req.body;
    if (!url) throw AppError.badRequest('url is required');

    const clean = url.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0].trim();
    const analysis = await competitorHijackService.analyzeCompetitor(clean, req.user.teamId, 'overview');
    // Persist topKeywords back to competitor record (enables Gaps tab)
    await _saveCompetitorKeywords(analysis, req.user.teamId);
    const report = await _saveResearchReport({
      teamId: req.user.teamId,
      kind: 'market',
      query: url,
      analysis,
    });
    return success(res, { ...analysis, reportId: report.id, savedAt: report.createdAt });
  } catch (err) { next(err); }
};

// GET /api/v1/research/reports/latest?kind=market|ad-intelligence
exports.getLatestReport = async (req, res, next) => {
  try {
    const kind = _parseKind(req.query.kind);
    await _pruneExpiredReports(req.user.teamId);

    const report = await prisma.researchReport.findFirst({
      where: {
        teamId: req.user.teamId,
        status: REPORT_STATUS[kind],
        createdAt: { gte: _cutoffDate() },
      },
      orderBy: { createdAt: 'desc' },
    });

    return success(res, {
      report: report ? {
        id: report.id,
        kind,
        query: report.query,
        createdAt: report.createdAt,
        analysis: report.adAnalysis ?? {},
      } : null,
    });
  } catch (err) {
    next(err);
  }
};

// GET /api/v1/research/reports?kind=market|ad-intelligence&limit=10
exports.getReports = async (req, res, next) => {
  try {
    const kind = _parseKind(req.query.kind);
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 10));
    await _pruneExpiredReports(req.user.teamId);

    const reports = await prisma.researchReport.findMany({
      where: {
        teamId: req.user.teamId,
        status: REPORT_STATUS[kind],
        createdAt: { gte: _cutoffDate() },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return success(res, {
      reports: reports.map((report) => ({
        id: report.id,
        kind,
        query: report.query,
        createdAt: report.createdAt,
        analysis: report.adAnalysis ?? {},
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * After a competitor analysis, update the stored Competitor record with
 * topKeywords from the crawl so CompetitorGapService can use them.
 */
async function _saveCompetitorKeywords(analysis, teamId) {
  if (!analysis || !analysis.domain) return;
  const topKws = (analysis.topKeywords || []).slice(0, 20).map(kw =>
    typeof kw === 'string' ? { keyword: kw, rank: 10 } : { keyword: kw.word || kw.keyword || '', rank: 10 }
  ).filter(k => k.keyword);
  if (!topKws.length) return;

  try {
    await prisma.competitor.updateMany({
      where: { teamId, domain: analysis.domain },
      data:  {
        topKeywords:   topKws,
        lastScrapedAt: new Date(),
      },
    });
  } catch (_) {
    // Non-fatal — gaps just won't update
  }
}

async function _saveResearchReport({ teamId, kind, query, analysis }) {
  await _pruneExpiredReports(teamId);

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

async function _pruneExpiredReports(teamId) {
  await prisma.researchReport.deleteMany({
    where: {
      teamId,
      status: { in: Object.values(REPORT_STATUS) },
      createdAt: { lt: _cutoffDate() },
    },
  });
}

function _cutoffDate() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

function _parseKind(rawKind) {
  if (rawKind === 'market') return 'market';
  if (rawKind === 'ad-intelligence' || rawKind === 'adIntel') return 'adIntel';
  throw AppError.badRequest('kind must be "market" or "ad-intelligence"');
}
