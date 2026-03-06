'use strict';

const prisma              = require('../config/prisma');
const seoAuditService     = require('../services/seo/SeoAuditService');
const keywordService      = require('../services/seo/KeywordTrackingService');
const KeywordService      = require('../services/keywords/KeywordService');
const KeywordDiscovery    = require('../services/keywords/KeywordDiscoveryService');
const competitorService   = require('../services/seo/CompetitorGapService');
const contentBriefService = require('../services/seo/ContentBriefService');
const { queues }          = require('../queues');
const { success, created, paginated } = require('../common/response');
const { parsePagination } = require('../common/pagination');
const AppError            = require('../common/AppError');
const { ACTIVE_STATUSES } = require('../services/seo/audit/AuditOrchestrator');

// ── SEO Audits ────────────────────────────────────────────────────────────────

/**
 * POST /api/v1/seo/audit
 *
 * Creates a SeoAudit record immediately, enqueues a Bull job with the record ID,
 * and returns 201 with { auditId } so the frontend can start polling GET /audit/:id.
 *
 * Duplicate guard: if the same team already has an in-progress audit for the same
 * URL, returns 409 with the existing auditId — no duplicate job is queued.
 *
 * This is v2 only (engineVersion=2). When SEO_ENGINE_V2=false the processor
 * falls through to the legacy SeoAuditService path.
 */
exports.triggerAudit = async (req, res, next) => {
  try {
    const { url }   = req.body;
    const { teamId } = req.user;

    // ── Duplicate-audit guard ───────────────────────────────────────────────
    const running = await prisma.seoAudit.findFirst({
      where: {
        teamId,
        url,
        status: { in: ACTIVE_STATUSES },
      },
      select: { id: true, status: true },
    });

    if (running) {
      throw AppError.conflict(
        `An audit for this URL is already ${running.status}. ` +
        `Poll GET /seo/audit/${running.id} for progress.`
      );
    }

    // ── Pre-create the record so we return auditId before the job runs ──────
    const featureFlags = require('../config/featureFlags');

const audit = await prisma.seoAudit.create({
  data: {
    teamId,
    url,
    status:        'pending',
    engineVersion: featureFlags.seoEngine.v2 ? 2 : 1,  // ← uses flag
  },
});

    const job = await queues.seoAudit.add(
      { teamId, url, auditId: audit.id, userId: req.user.userId },
      {
        // Deterministic jobId — prevents double-enqueue on accidental double-submit
        jobId: `audit:${teamId}:${audit.id}`,
      }
    );

    return created(res, {
      auditId: audit.id,
      jobId:   job.id,
      message: 'SEO audit queued. Poll GET /seo/audit/:id for status and results.',
    });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/seo/audit/:id
 *
 * Returns the full structured audit result.
 * Detects engineVersion and maps v1 / v2 payloads to the same frontend contract.
 *
 * Response shape (v2):
 * {
 *   id, url, status, engineVersion, createdAt,
 *   summary:   { score, grade, totalIssues, criticalIssues, highIssues, mediumIssues, lowIssues },
 *   categories: [{ id, label, score, weight, deducted, fallback }],
 *   performance: { score, pagesAnalyzed, fallback, metrics: { fcp, lcp, tbt, cls, si, tti } },
 *   technicalIssues: Issue[],
 *   contentIssues:   Issue[],
 *   structureIssues: Issue[],
 *   crawlStats:      CrawlStats,
 *   recommendations: RecommendationEntry[],
 *   executiveSummary: string|null,
 * }
 */
exports.getAudit = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { teamId } = req.user;

    const audit = await prisma.seoAudit.findFirst({
      where: { id, teamId },
    });

    if (!audit) throw AppError.notFound('Audit');

    const payload = audit.engineVersion >= 2
      ? mapV2Audit(audit)
      : mapV1Audit(audit);

    return success(res, payload);
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/seo/audits
 * List all audits for the team (paginated), newest first.
 */
exports.getAudits = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const { items, total } = await seoAuditService.getAudits(req.user.teamId, { page, limit });
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/seo/audit/:id
 * Delete a single audit record that belongs to the authenticated team.
 */
exports.deleteAudit = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { teamId } = req.user;

    const audit = await prisma.seoAudit.findFirst({ where: { id, teamId }, select: { id: true } });
    if (!audit) throw AppError.notFound('Audit');

    await prisma.seoAudit.delete({ where: { id } });
    return res.status(204).end();
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/seo/audits
 * Delete ALL audits for the authenticated team.
 */
exports.deleteAllAudits = async (req, res, next) => {
  try {
    const { teamId } = req.user;
    await prisma.seoAudit.deleteMany({ where: { teamId } });
    return res.status(204).end();
  } catch (err) { next(err); }
};

// ── Response mappers ──────────────────────────────────────────────────────────

/**
 * Map a v2 SeoAudit DB record to the frontend response contract.
 *
 * v2 fields: issues, performanceData, categoryScores, rawCrawlData, grade, summary
 *
 * Why this structure is frontend-friendly:
 *   - `summary` is a flat object — one fetch gives the dashboard overview
 *   - `categories` is an array — maps directly to chart bars, no key iteration
 *   - Issues are split by category — each UI tab (Technical / Content / Structure)
 *     gets exactly its data without filtering
 *   - `performance.metrics` is flat key→value — easy to iterate for metric cards
 *   - `recommendations` is pre-sorted and deduplicated — rendered as-is
 *
 * @param {SeoAudit} audit
 * @returns {object}
 */
function mapV2Audit(audit) {
  const issues          = Array.isArray(audit.issues)         ? audit.issues         : [];
  const perfData        = audit.performanceData               ?? {};
  const catScores       = audit.categoryScores                ?? {};
  const crawlData       = audit.rawCrawlData                  ?? {};
  const recommendations = Array.isArray(audit.recommendations) ? audit.recommendations : [];

  const issueCount      = catScores.issueCount ?? countIssues(issues);
  const categories      = catScores.categories ?? {};

  // ── Summary card ─────────────────────────────────────────────────────────
  const summary = {
    score:          audit.overallScore ?? 0,
    grade:          audit.grade        ?? 'F',
    totalIssues:    issueCount.total    ?? 0,
    criticalIssues: issueCount.critical ?? 0,
    highIssues:     issueCount.high     ?? 0,
    mediumIssues:   issueCount.medium   ?? 0,
    lowIssues:      issueCount.low      ?? 0,
  };

  // ── Category array ───────────────────────────────────────────────────────
  const CATEGORY_LABELS = {
    technical:   'Technical SEO',
    performance: 'Performance',
    content:     'Content',
    structure:   'Site Structure',
  };

  const categoriesArr = ['technical', 'performance', 'content', 'structure'].map((id) => {
    const cat = categories[id] ?? {};
    return {
      id,
      label:    CATEGORY_LABELS[id],
      score:    cat.score    ?? 0,
      weight:   cat.weight   ?? 0,
      deducted: cat.deducted ?? 0,
      fallback: cat.fallback ?? false,
    };
  });

  // ── Split issues by category ─────────────────────────────────────────────
  const technicalIssues = issues.filter((i) => i.category === 'technical');
  const contentIssues   = issues.filter((i) => i.category === 'content');
  const structureIssues = issues.filter((i) => i.category === 'structure');

  // ── Performance block ────────────────────────────────────────────────────
  const performance = {
    score:         perfData.score         ?? null,
    pagesAnalyzed: perfData.pagesAnalyzed ?? 0,
    fallback:      perfData.fallback      ?? true,
    fallbackReason:perfData.fallbackReason ?? null,
    metrics:       perfData.metrics       ?? {},
  };

  // ── Crawl stats ───────────────────────────────────────────────────────────
  const crawlStats = crawlData.crawlStats ?? null;

  return {
    id:            audit.id,
    url:           audit.url,
    status:        audit.status,
    engineVersion: audit.engineVersion,
    createdAt:     audit.createdAt,

    summary,
    categories:      categoriesArr,
    performance,
    technicalIssues,
    contentIssues,
    structureIssues,
    crawlStats,
    recommendations,
    executiveSummary: _parseSummary(audit.summary),
  };
}

/**
 * Parse the summary TEXT column back to an object.
 * Returns null gracefully on any parse error.
 */
function _parseSummary(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw; // already parsed (future-proofing)
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * Map a v1 (legacy SeoAuditService) DB record to the same frontend contract.
 *
 * v1 fields: technicalIssues (raw array of {type, rule, message}), recommendations
 * These are mapped to the minimal subset the frontend needs — no crawlStats,
 * no performance data, no categories scoring breakdown.
 *
 * @param {SeoAudit} audit
 * @returns {object}
 */
function mapV1Audit(audit) {
  const rawIssues       = Array.isArray(audit.technicalIssues) ? audit.technicalIssues : [];
  const rawRecs         = Array.isArray(audit.recommendations)  ? audit.recommendations  : [];

  const criticalCount   = rawIssues.filter((i) => i.type === 'error').length;
  const highCount       = rawIssues.filter((i) => i.type === 'warning').length;
  const lowCount        = rawIssues.filter((i) => i.type === 'info').length;

  return {
    id:            audit.id,
    url:           audit.url,
    status:        audit.status,
    engineVersion: audit.engineVersion ?? 1,
    createdAt:     audit.createdAt,

    summary: {
      score:          audit.overallScore ?? 0,
      grade:          scoreToGrade(audit.overallScore ?? 0),
      totalIssues:    rawIssues.length,
      criticalIssues: criticalCount,
      highIssues:     highCount,
      mediumIssues:   0,
      lowIssues:      lowCount,
    },

    // v1 has no category breakdown — return empty/neutral values
    categories: [
      { id: 'technical',   label: 'Technical SEO', score: audit.overallScore ?? 0, weight: 1, deducted: 0, fallback: false },
      { id: 'performance', label: 'Performance',   score: null,  weight: 0, deducted: 0, fallback: true  },
      { id: 'content',     label: 'Content',       score: null,  weight: 0, deducted: 0, fallback: true  },
      { id: 'structure',   label: 'Site Structure', score: null, weight: 0, deducted: 0, fallback: true  },
    ],

    performance: { score: null, pagesAnalyzed: 0, fallback: true, metrics: {} },

    // Map v1 issues into the v2 shape as best we can
    technicalIssues: rawIssues.map((i) => ({
      id:             i.rule,
      ruleId:         i.rule,
      severity:       i.type === 'error' ? 'high' : (i.type === 'warning' ? 'medium' : 'low'),
      category:       'technical',
      affectedPages:  [],
      affectedCount:  0,
      impactScore:    0,
      description:    i.message,
      recommendation: null,
      autoFixable:    false,
    })),
    contentIssues:   [],
    structureIssues: [],
    crawlStats:       null,

    recommendations: rawRecs.map((r) => ({
      issueId:     r.rule,
      severity:    null,
      category:    'technical',
      text:        r.recommendation,
      autoFixable: false,
    })),
    executiveSummary: null,
  };
}

// ── Utility helpers ───────────────────────────────────────────────────────────

function countIssues(issues) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
  for (const i of issues) {
    if (i.severity in counts) { counts[i.severity]++; counts.total++; }
  }
  return counts;
}

function scoreToGrade(score) {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 45) return 'D';
  return 'F';
}

// ── Keyword Tracking ──────────────────────────────────────────────────────────

exports.getKeywords = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { items, total } = await keywordService.getKeywords(req.user.teamId, { page, limit });
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

exports.getOpportunities = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const data  = await keywordService.getOpportunities(req.user.teamId, limit);
    return success(res, { opportunities: data });
  } catch (err) { next(err); }
};

exports.syncKeywords = async (req, res, next) => {
  try {
    const job = await queues.keywordSync.add({ teamId: req.user.teamId });
    return success(res, { jobId: job.id, message: 'Keyword sync queued' });
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/seo/keywords
 * Add a keyword to the team's tracking list.
 * Body: { keyword (required), trackedUrl?, searchVolume?, difficulty?, source? }
 */
exports.createKeyword = async (req, res, next) => {
  try {
    const { keyword, trackedUrl, searchVolume, difficulty, source } = req.body;

    if (!keyword || typeof keyword !== 'string' || !keyword.trim()) {
      throw AppError.badRequest('keyword is required');
    }
    if (keyword.trim().length > 200) {
      throw AppError.badRequest('keyword must be 200 characters or fewer');
    }
    if (searchVolume !== undefined && (typeof searchVolume !== 'number' || searchVolume < 0)) {
      throw AppError.badRequest('searchVolume must be a non-negative number');
    }
    if (difficulty !== undefined && (typeof difficulty !== 'number' || difficulty < 0 || difficulty > 100)) {
      throw AppError.badRequest('difficulty must be between 0 and 100');
    }

    const kw = await KeywordService.createKeyword(req.user.teamId, req.user.userId, {
      keyword, trackedUrl, searchVolume, difficulty, source,
    });
    return created(res, kw);
  } catch (err) { next(err); }
};

/**
 * DELETE /api/v1/seo/keywords/:id
 * Remove a tracked keyword (team-scoped).
 */
exports.deleteKeyword = async (req, res, next) => {
  try {
    await KeywordService.deleteKeyword(req.params.id, req.user.teamId);
    return res.status(204).end();
  } catch (err) { next(err); }
};

/**
 * POST /api/v1/seo/keywords/discover-from-audit
 * Extract keyword suggestions from a completed SEO audit.
 * Body: { auditId (required) }
 */
exports.discoverFromAudit = async (req, res, next) => {
  try {
    const { auditId } = req.body;
    if (!auditId) throw AppError.badRequest('auditId is required');

    const suggestions = await KeywordDiscovery.discoverFromAudit(auditId, req.user.teamId);
    return success(res, { suggestions });
  } catch (err) { next(err); }
};

/**
 * GET /api/v1/seo/keywords/:id/history
 * Returns rank history (up to 30 data points) for a single keyword.
 */
exports.getKeywordHistory = async (req, res, next) => {
  try {
    const { id }     = req.params;
    const { teamId } = req.user;

    const kw = await prisma.keyword.findFirst({ where: { id, teamId }, select: { id: true } });
    if (!kw) throw AppError.notFound('Keyword');

    const records = await prisma.keywordRank.findMany({
      where:   { keywordId: id },
      orderBy: { recordedAt: 'asc' },
      take:    30,
      select:  { rank: true, recordedAt: true },
    });

    return success(res, {
      history: records.map((r) => ({ rank: r.rank, date: r.recordedAt })),
    });
  } catch (err) { next(err); }
};

// ── Competitor Gap ────────────────────────────────────────────────────────────

exports.getCompetitorGaps = async (req, res, next) => {
  try {
    const { competitorId } = req.query;
    const result = await competitorService.analyze(req.user.teamId, competitorId || null);
    return success(res, result);
  } catch (err) { next(err); }
};

// ── Content Briefs ────────────────────────────────────────────────────────────

exports.generateBrief = async (req, res, next) => {
  try {
    const { targetKeyword } = req.body;
    const brief = await contentBriefService.generate(req.user.teamId, targetKeyword);
    return created(res, { brief });
  } catch (err) { next(err); }
};

exports.getBriefs = async (req, res, next) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const { items, total } = await contentBriefService.getBriefs(req.user.teamId, { page, limit });
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

exports.deleteBrief = async (req, res, next) => {
  try {
    await contentBriefService.deleteBrief(req.params.id, req.user.teamId);
    return res.status(204).end();
  } catch (err) { next(err); }
};

// ── Keyword Research ──────────────────────────────────────────────────────────

const keywordResearchService = require('../services/seo/KeywordResearchService');
const cache                  = require('../cache');

exports.researchKeyword = async (req, res, next) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.status(400).json({ success: false, error: { message: 'q must be at least 2 characters' } });
    }

    const cacheKey = `kw:research:${q.toLowerCase()}`;
    const { data, cached } = await cache.getOrSet(
      cacheKey,
      () => keywordResearchService.research(q),
      60 * 120  // 2-hour cache
    );

    return success(res, { ...data, _cached: cached });
  } catch (err) { next(err); }
};
