'use strict';

const { success, created } = require('../common/response');
const AppError = require('../common/AppError');
const researchOrchestrator = require('../services/research/ResearchOrchestratorService');

// ── Competitors CRUD ──────────────────────────────────────────────────────────

// GET /api/v1/competitors
exports.listCompetitors = async (req, res, next) => {
  try {
    const competitors = await researchOrchestrator.listCompetitors(req.user.teamId);
    return success(res, { competitors });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/competitors
exports.createCompetitor = async (req, res, next) => {
  try {
    const competitor = await researchOrchestrator.createCompetitor(req.user.teamId, req.body);
    return created(res, { competitor });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/v1/competitors/:id
exports.deleteCompetitor = async (req, res, next) => {
  try {
    await researchOrchestrator.deleteCompetitor(req.user.teamId, req.params.id);
    return res.status(204).end();
  } catch (err) {
    next(err);
  }
};

// ── Hijack Analysis ───────────────────────────────────────────────────────────

// GET /api/v1/research/hijack-analysis?domain=example.com
exports.hijackAnalysis = async (req, res, next) => {
  try {
    const { analysis, report } = await researchOrchestrator.runAttackAnalysis(req.user.teamId, req.query.domain);
    return success(res, { ...analysis, reportId: report.id, savedAt: report.createdAt });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/competitors/analyze   { url: "https://competitor.com" }
exports.analyzeUrl = async (req, res, next) => {
  try {
    const { analysis, report } = await researchOrchestrator.runOverviewAnalysis(req.user.teamId, req.body.url);
    return success(res, { ...analysis, reportId: report.id, savedAt: report.createdAt });
  } catch (err) { next(err); }
};

// GET /api/v1/research/reports/latest?kind=market|ad-intelligence
exports.getLatestReport = async (req, res, next) => {
  try {
    const kind = _parseKind(req.query.kind);
    const report = await researchOrchestrator.getLatestReport(req.user.teamId, kind);

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
    const reports = await researchOrchestrator.getReports(req.user.teamId, kind, limit);

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

function _parseKind(rawKind) {
  if (rawKind === 'market') return 'market';
  if (rawKind === 'ad-intelligence' || rawKind === 'adIntel') return 'adIntel';
  throw AppError.badRequest('kind must be "market" or "ad-intelligence"');
}
