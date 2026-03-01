'use strict';

const SEO_CONFIG = require('../../../../config/seo');
const logger     = require('../../../../config/logger');

/**
 * Categories the ScoringEngine knows about.
 * 'performance' is excluded here because its score comes from Lighthouse,
 * not from Issue[] — it is handled separately.
 *
 * @type {string[]}
 */
const ISSUE_CATEGORIES = ['technical', 'content', 'structure'];

/**
 * ScoringEngine — pure, deterministic score calculator.
 *
 * Inputs:
 *   issues[]        — flat array from TechnicalAnalyzer.analyze()
 *   crawlResult     — CrawlResult from CrawlEngine, used for page-count denominator
 *   performanceScore — 0-100 Lighthouse score (null → fallback score of 50)
 *
 * Output (AuditScore):
 * {
 *   overall:   number,          // 0–100 weighted composite
 *   grade:     string,          // A/B/C/D/F letter grade
 *   categories: {
 *     technical:   CategoryScore,
 *     performance: CategoryScore,
 *     content:     CategoryScore,
 *     structure:   CategoryScore,
 *   },
 *   issueCount: {
 *     critical: number,
 *     high:     number,
 *     medium:   number,
 *     low:      number,
 *     total:    number,
 *   },
 *   deductionAudit: DeductionEntry[],
 * }
 *
 * CategoryScore:
 * {
 *   score:    number,   // 0–100
 *   weight:   number,   // from config (e.g. 0.30)
 *   deducted: number,   // total points removed from 100
 *   fallback: boolean,  // true only for performance when Lighthouse fails
 * }
 *
 * DeductionEntry:
 * {
 *   issueId:        string,
 *   severity:       string,
 *   category:       string,
 *   affectedCount:  number,
 *   coverage:       number,   // 0–1 fraction of crawled pages
 *   siteWide:       boolean,  // coverage >= siteWideCoverageThreshold
 *   baseDeduction:  number,
 *   finalDeduction: number,   // baseDeduction × 2 if siteWide
 * }
 *
 * Scoring algorithm:
 *   1. Each issue category starts at 100.
 *   2. For every Issue[], compute:
 *        coverage      = affectedCount / totalPages
 *        siteWide      = coverage >= siteWideCoverageThreshold
 *        baseDeduction = severityDeductions[severity]
 *        finalDeduction = siteWide ? baseDeduction × 2 : baseDeduction
 *      Subtract finalDeduction from the category score. Clamp at 0.
 *   3. Performance score is sourced from Lighthouse (passed as 3rd arg).
 *      If null (Lighthouse failed / disabled), use performanceFallbackScore.
 *   4. overall = Σ (categoryScore × weight), rounded to 1 decimal.
 *   5. All scores are clamped to [0, 100].
 *
 * Site-wide multiplier rationale:
 *   An issue that affects 60% of crawled pages is systemic — it likely means
 *   a template or CMS default is broken, not just one page.  Doubling the
 *   deduction reflects that this is harder to fix and has wider SEO impact.
 *   Issues with affectedCount=0 (e.g. no_sitemap — no specific page to blame)
 *   are treated as baseline (no multiplier) since severity already encodes
 *   their global impact.
 */
class ScoringEngine {
  constructor() {
    const cfg = SEO_CONFIG.scoring;

    this._weights           = cfg.weights;
    this._deductions        = cfg.severityDeductions;
    this._coverageThreshold = cfg.siteWideCoverageThreshold;
    this._perfFallback      = cfg.performanceFallbackScore;

    // Validate weights sum to 1.0 (±0.01 tolerance for floating point)
    const sum = Object.values(this._weights).reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.01) {
      throw new Error(
        `ScoringEngine: category weights must sum to 1.0, got ${sum.toFixed(4)}`
      );
    }
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Compute the full AuditScore from a flat issues list + crawl context.
   *
   * @param {Issue[]}      issues           - output of TechnicalAnalyzer.analyze()
   * @param {CrawlResult}  crawlResult      - output of CrawlEngine.crawl()
   * @param {number|null}  [performanceScore] - Lighthouse composite 0-100, or null
   * @param {object}       [perfMetrics]    - Lighthouse per-metric data for bonus checks
   * @returns {AuditScore}
   */
  score(issues, crawlResult, performanceScore = null, perfMetrics = {}) {
    if (!Array.isArray(issues)) {
      throw new TypeError('ScoringEngine.score: issues must be an array');
    }
    if (!crawlResult || !Array.isArray(crawlResult.pages)) {
      throw new TypeError('ScoringEngine.score: crawlResult must have a pages array');
    }

    const totalPages = crawlResult.pages.length || 1; // guard against 0-page edge case

    // ── 1. Per-category deduction pass ────────────────────────────────────────
    // Start each rule-driven category at 100 and subtract.
    const categoryRaw = {
      technical: 100,
      content:   100,
      structure: 100,
    };
    const categoryDeducted = {
      technical: 0,
      content:   0,
      structure: 0,
    };
    const deductionAudit = [];

    for (const issue of issues) {
      const { id, severity, category, affectedCount } = issue;

      if (!ISSUE_CATEGORIES.includes(category)) {
        logger.warn({ issueId: id, category }, 'ScoringEngine: unknown issue category — skipped');
        continue;
      }

      const baseDeduction = this._deductions[severity];
      if (baseDeduction === undefined) {
        logger.warn({ issueId: id, severity }, 'ScoringEngine: unknown severity — skipped');
        continue;
      }

      // Site-wide multiplier: only applies to per-page issues (affectedCount > 0)
      const coverage  = affectedCount > 0 ? affectedCount / totalPages : 0;
      const siteWide  = coverage >= this._coverageThreshold;
      const finalDeduction = siteWide ? baseDeduction * 2 : baseDeduction;

      categoryRaw[category]      = Math.max(0, categoryRaw[category] - finalDeduction);
      categoryDeducted[category] += finalDeduction;

      deductionAudit.push({
        issueId:        id,
        severity,
        category,
        affectedCount:  affectedCount ?? 0,
        coverage:       parseFloat(coverage.toFixed(4)),
        siteWide,
        baseDeduction,
        finalDeduction,
      });
    }

    // ── 2. Performance category ────────────────────────────────────────────────
    const perfFallback  = performanceScore === null || performanceScore === undefined;
    const perfScore     = perfFallback
      ? this._perfFallback
      : Math.min(100, Math.max(0, Math.round(performanceScore)));

    if (perfFallback) {
      logger.debug(
        { fallbackScore: this._perfFallback },
        'ScoringEngine: no Lighthouse score — using performance fallback'
      );
    }

    // ── 3. Clamp all rule-driven categories ───────────────────────────────────
    for (const cat of ISSUE_CATEGORIES) {
      categoryRaw[cat] = Math.max(0, Math.min(100, categoryRaw[cat]));
    }

    // ── 4. Weighted overall score ──────────────────────────────────────────────
    const w = this._weights;
    const rawOverall = parseFloat(
      (
        categoryRaw.technical   * w.technical   +
        perfScore               * w.performance +
        categoryRaw.content     * w.content     +
        categoryRaw.structure   * w.structure
      ).toFixed(1)
    );

    // ── 4b. Bonus points ───────────────────────────────────────────────────────
    // Positive signals that reward sites doing things right.
    // Bonuses are capped so the overall never exceeds 100.
    let bonus = 0;
    const livePages = crawlResult.pages.filter(
      (p) => !p.failed && p.statusCode >= 200 && p.statusCode < 400
    );

    // +5 HTTPS bonus: every live page was served over HTTPS
    if (livePages.length > 0 && livePages.every((p) => p.isHttps)) {
      bonus += 5;
    }

    // +5 Schema bonus: at least one page has structured data
    if (livePages.some((p) => p.hasSchema)) {
      bonus += 5;
    }

    // +3 Fast LCP bonus: average LCP < 2500ms (Good threshold per Google)
    const lcp = perfMetrics?.lcp;
    if (!perfFallback && lcp?.value != null && lcp.value < 2500) {
      bonus += 3;
    }

    // +3 Good CLS bonus: average CLS < 0.1 (Good threshold per Google)
    const cls = perfMetrics?.cls;
    if (!perfFallback && cls?.value != null && cls.value < 0.1) {
      bonus += 3;
    }

    const overall = Math.min(100, parseFloat((rawOverall + bonus).toFixed(1)));

    // ── 5. Issue count by severity ─────────────────────────────────────────────
    const issueCount = { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    for (const issue of issues) {
      if (issue.severity in issueCount) {
        issueCount[issue.severity]++;
        issueCount.total++;
      }
    }

    // ── 6. Assemble result ─────────────────────────────────────────────────────
    const auditScore = {
      overall,
      grade: this._grade(overall),
      categories: {
        technical: {
          score:    categoryRaw.technical,
          weight:   w.technical,
          deducted: categoryDeducted.technical,
          fallback: false,
        },
        performance: {
          score:    perfScore,
          weight:   w.performance,
          deducted: 0,  // performance score comes from Lighthouse, not deduction math
          fallback: perfFallback,
        },
        content: {
          score:    categoryRaw.content,
          weight:   w.content,
          deducted: categoryDeducted.content,
          fallback: false,
        },
        structure: {
          score:    categoryRaw.structure,
          weight:   w.structure,
          deducted: categoryDeducted.structure,
          fallback: false,
        },
      },
      issueCount,
      deductionAudit,
    };

    logger.debug(
      {
        rawOverall,
        bonus,
        overall,
        grade:       auditScore.grade,
        totalPages,
        issueCount,
        categories: {
          technical:   categoryRaw.technical,
          performance: perfScore,
          content:     categoryRaw.content,
          structure:   categoryRaw.structure,
        },
      },
      'ScoringEngine: scoring complete'
    );

    return auditScore;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Map a 0-100 score to a letter grade.
   *
   * A  90–100   Excellent
   * B  75–89    Good
   * C  60–74    Needs work
   * D  45–59    Poor
   * F   0–44    Critical
   *
   * @param {number} score
   * @returns {'A'|'B'|'C'|'D'|'F'}
   */
  _grade(score) {
    if (score >= 90) return 'A';
    if (score >= 75) return 'B';
    if (score >= 60) return 'C';
    if (score >= 40) return 'D';  // was 45 — Phase 2 boundary update
    return 'F';
  }
}

module.exports = ScoringEngine;
