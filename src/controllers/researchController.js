'use strict';

const prisma                   = require('../config/prisma');
const competitorHijackService  = require('../services/ai/CompetitorHijackService');
const { success, created }     = require('../common/response');
const AppError                  = require('../common/AppError');

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

    const analysis = await competitorHijackService.analyzeCompetitor(domain, req.user.teamId);
    return success(res, analysis);
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
    const analysis = await competitorHijackService.analyzeCompetitor(clean, req.user.teamId);
    return success(res, analysis);
  } catch (err) { next(err); }
};
