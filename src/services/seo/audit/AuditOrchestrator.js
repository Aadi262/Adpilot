'use strict';

const prisma              = require('../../../config/prisma');
const logger              = require('../../../config/logger');
const SEO_CONFIG          = require('../../../config/seo');
const PLAN_LIMITS         = require('../../../config/limits');
const featureFlags        = require('../../../config/featureFlags');

const PuppeteerAdapter    = require('./adapters/PuppeteerAdapter');
const CrawlEngine         = require('./engines/CrawlEngine');
const TechnicalAnalyzer   = require('./engines/TechnicalAnalyzer');
const PerformanceEngine   = require('./engines/PerformanceEngine');
const ScoringEngine       = require('./engines/ScoringEngine');
const SeoSummaryService   = require('../SeoSummaryService');

/**
 * Statuses that indicate an audit is actively being processed.
 * Used for duplicate-detection and timeout classification.
 */
const ACTIVE_STATUSES = ['pending', 'crawling', 'analyzing', 'scoring', 'summarizing'];

/**
 * Progress checkpoints 0–100 reported to Bull.
 * Drives the progress bar in the frontend via job polling.
 */
const PROGRESS = {
  start:       5,
  crawling:   10,
  crawlDone:  45,
  analyzing:  55,
  perf:       65,
  perfDone:   75,
  scoring:    80,
  summarizing:90,
  done:      100,
};

/**
 * Overall wall-clock budget per audit job attempt.
 * Bull will also enforce its own job timeout if configured on the queue.
 *
 * 10 min is appropriate for large sites (business plan, 1000 pages).
 * Starter sites (50 pages) complete in ~2 min.
 * Override via env: SEO_AUDIT_TIMEOUT_MS
 */
const TOTAL_TIMEOUT_MS = parseInt(process.env.SEO_AUDIT_TIMEOUT_MS, 10) || 10 * 60 * 1_000;

/**
 * AuditOrchestrator — drives one complete SEO v2 audit end-to-end.
 *
 * Stage pipeline:
 *   pending → crawling  (BFS crawl via CrawlEngine + PuppeteerAdapter)
 *           → analyzing (issue detection via TechnicalAnalyzer + rule registry)
 *           → scoring   (PerformanceEngine, then ScoringEngine)
 *           → summarizing (LLM executive summary — stub until implemented)
 *           → completed
 *                      ↘ failed (any unrecoverable error)
 *
 * Production safeguards:
 *   1. TOTAL_TIMEOUT_MS wall-clock budget — Promise.race kills hung audits
 *   2. Per-stage try/catch — one failing stage marks failed, re-throws for Bull retry
 *   3. Non-retriable errors (team not found) — marked failed, NOT re-thrown
 *   4. Puppeteer browser always closed in finally (no zombie Chrome processes)
 *   5. PerformanceEngine uses a separate, isolated browser — never shares with crawl
 *   6. PerformanceEngine failure is non-fatal — fallback score used, audit continues
 *   7. Plan limits read at job-execution time — always reflects current subscription
 *
 * Storage (engineVersion=2 fields):
 *   overallScore     ← rounded overall score 0-100
 *   grade            ← letter grade A-F
 *   issues           ← full Issue[] from TechnicalAnalyzer
 *   performanceData  ← PerformanceEngine result (score, metrics, pageResults)
 *   categoryScores   ← ScoringEngine categories + issueCount + deductionAudit
 *   rawCrawlData     ← crawlStats + brokenLinks + redirectChains (NOT full pages)
 *   recommendations  ← deduplicated recommendations for quick API access
 *   summary          ← LLM summary (null until implemented)
 *   engineVersion    ← 2
 */
class AuditOrchestrator {
  constructor() {
    this._scorer   = new ScoringEngine();
    this._analyzer = new TechnicalAnalyzer();
  }

  // ── Public entry point ─────────────────────────────────────────────────────

  /**
   * Run a complete audit for the given Bull job.
   * Wraps _pipeline() in a wall-clock timeout.
   *
   * @param {Bull.Job} job
   * @returns {Promise<AuditResult>}
   */
  async run(job) {
    // Mutable context ref — timeout handler needs auditId which is resolved inside _pipeline
    const ctx = { auditId: job.data.auditId ?? null };

    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new Error(`SEO audit exceeded ${TOTAL_TIMEOUT_MS / 1000}s time limit`)),
        TOTAL_TIMEOUT_MS
      );
    });

    try {
      const result = await Promise.race([
        this._pipeline(job, ctx),
        timeoutPromise,
      ]);
      return result;
    } catch (err) {
      // On timeout or unhandled error: persist failed state if we know the auditId.
      // _pipeline already calls _failAudit for stage-level errors, so we guard
      // against double-writing by only calling it for timeout errors.
      if (err.message.includes('time limit') && ctx.auditId) {
        await this._failAudit(ctx.auditId, err.message).catch(() => {});
      }
      throw err; // re-throw so Bull logs it and retries
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  // ── Pipeline ───────────────────────────────────────────────────────────────

  /**
   * The full audit pipeline. Mutates ctx.auditId once the DB record is known.
   *
   * @param {Bull.Job} job
   * @param {{ auditId: string|null }} ctx
   * @returns {Promise<AuditResult>}
   */
  async _pipeline(job, ctx) {
    const { teamId, url } = job.data;
    await job.progress(PROGRESS.start);

    // ── 1. Load team + plan limits ──────────────────────────────────────────
    const team = await prisma.team.findUnique({
      where:  { id: teamId },
      select: { id: true, plan: true },
    });

    if (!team) {
      logger.warn('AuditOrchestrator: team not found — aborting (non-retriable)', { teamId });
      if (ctx.auditId) await this._failAudit(ctx.auditId, 'Team not found');
      return null; // non-retriable — do NOT re-throw
    }

    const limits = PLAN_LIMITS[team.plan] || PLAN_LIMITS.starter;

    // ── 2. Resolve or create the SeoAudit record ────────────────────────────
    if (ctx.auditId) {
      // Record was pre-created by the API route (preferred path)
      await this._setStatus(ctx.auditId, 'crawling', job, PROGRESS.crawling);
    } else {
      const audit = await prisma.seoAudit.create({
        data: { teamId, url, status: 'crawling', engineVersion: 2 },
      });
      ctx.auditId = audit.id;
      await job.progress(PROGRESS.crawling);
    }

    logger.info('AuditOrchestrator: audit started', {
      auditId:  ctx.auditId,
      teamId,
      url,
      plan:     team.plan,
      maxPages: limits.maxPagesPerAudit,
    });

    // ── 3. CRAWL ────────────────────────────────────────────────────────────
    let crawlResult;
    const adapter = new PuppeteerAdapter();

    try {
      const engine = new CrawlEngine(adapter);
      crawlResult  = await engine.crawl(url, {
        maxPages:    limits.maxPagesPerAudit,
        maxDepth:    SEO_CONFIG.crawl.maxDepth,
        concurrency: SEO_CONFIG.crawl.concurrency,
      });
    } catch (err) {
      await this._failAudit(ctx.auditId, `Crawl failed: ${err.message}`);
      throw err; // retriable
    } finally {
      // ALWAYS close the Puppeteer browser — never leave orphan Chrome processes
      await adapter.close().catch((e) =>
        logger.warn('AuditOrchestrator: adapter.close() error', { err: e.message })
      );
    }

    logger.info('AuditOrchestrator: crawl complete', {
      auditId:      ctx.auditId,
      pagesCrawled: crawlResult.crawlStats.pagesCrawled,
      durationMs:   crawlResult.crawlStats.durationMs,
    });

    await job.progress(PROGRESS.crawlDone);

    // ── 4. ANALYZE ──────────────────────────────────────────────────────────
    await this._setStatus(ctx.auditId, 'analyzing', job, PROGRESS.analyzing);

    let issues;
    try {
      issues = this._analyzer.analyze(crawlResult);
    } catch (err) {
      await this._failAudit(ctx.auditId, `Analysis failed: ${err.message}`);
      throw err;
    }

    logger.info('AuditOrchestrator: analysis complete', {
      auditId:     ctx.auditId,
      issuesFound: issues.length,
    });

    // ── 5. PERFORMANCE (Lighthouse) ─────────────────────────────────────────
    // Runs in 'scoring' status since it's part of the scoring pipeline.
    await this._setStatus(ctx.auditId, 'scoring', job, PROGRESS.perf);

    let performanceData;
    const lighthouseEnabled = featureFlags.lighthouse.enabled;

    if (lighthouseEnabled) {
      try {
        performanceData = await PerformanceEngine.analyze(crawlResult, {
          pagesLimit: limits.lighthousePagesLimit,
        });
      } catch (err) {
        // Lighthouse failure is NON-FATAL — fallback score used, audit continues
        logger.warn('AuditOrchestrator: Lighthouse error — using fallback', {
          auditId: ctx.auditId,
          err:     err.message,
        });
        performanceData = PerformanceEngine._fallback(`Lighthouse error: ${err.message}`);
      }
    } else {
      logger.debug('AuditOrchestrator: Lighthouse disabled by feature flag', {
        auditId: ctx.auditId,
      });
      performanceData = PerformanceEngine._fallback('Lighthouse disabled (LIGHTHOUSE_ENABLED=false)');
    }

    await job.progress(PROGRESS.perfDone);

    logger.info('AuditOrchestrator: performance complete', {
      auditId:       ctx.auditId,
      perfScore:     performanceData.score,
      pagesAnalyzed: performanceData.pagesAnalyzed,
      fallback:      performanceData.fallback,
    });

    // ── 6. SCORE ────────────────────────────────────────────────────────────
    await job.progress(PROGRESS.scoring);

    let auditScore;
    try {
      auditScore = this._scorer.score(issues, crawlResult, performanceData.score, performanceData.metrics);
    } catch (err) {
      await this._failAudit(ctx.auditId, `Scoring failed: ${err.message}`);
      throw err;
    }

    logger.info('AuditOrchestrator: scoring complete', {
      auditId:    ctx.auditId,
      overall:    auditScore.overall,
      grade:      auditScore.grade,
      issueCount: auditScore.issueCount,
    });

    // ── 7. SUMMARIZE (LLM executive summary via Claude API) ─────────────────
    const summaryEnabled = featureFlags.seoSummary.enabled && limits.summaryEnabled;
    let summary = null;

    if (summaryEnabled) {
      await this._setStatus(ctx.auditId, 'summarizing', job, PROGRESS.summarizing);
      try {
        summary = await SeoSummaryService.generate({
          url:             job.data.url,
          overallScore:    Math.round(auditScore.overall),
          grade:           auditScore.grade,
          issues,
          categoryScores: {
            categories:  auditScore.categories,
            issueCount:  auditScore.issueCount,
          },
          performanceData,
          existingSummary: null,
        });

        logger.info('AuditOrchestrator: summary generated', {
          auditId:   ctx.auditId,
          hasSummary: !!summary,
        });
      } catch (summaryErr) {
        // Summary failure is NON-FATAL — audit completes without it
        logger.warn('AuditOrchestrator: summary generation failed — continuing', {
          auditId: ctx.auditId,
          err:     summaryErr.message,
        });
      }
    }

    // ── 8. PERSIST ──────────────────────────────────────────────────────────
    const recommendations = this._extractRecommendations(issues);

    // rawCrawlData: store metadata but NOT the full pages array (can be 1000s of objects)
    const rawCrawlData = {
      crawlStats:     crawlResult.crawlStats,
      brokenLinks:    crawlResult.brokenLinks,
      redirectChains: crawlResult.redirectChains,
    };

    const categoryScores = {
      categories:     auditScore.categories,
      issueCount:     auditScore.issueCount,
      deductionAudit: auditScore.deductionAudit,
    };

    await prisma.seoAudit.update({
      where: { id: ctx.auditId },
      data:  {
        status:          'completed',
        engineVersion:   2,
        overallScore:    Math.round(auditScore.overall),
        grade:           auditScore.grade,
        issues,
        performanceData,
        categoryScores,
        rawCrawlData,
        recommendations,
        // summary column is TEXT — serialize the JSON object to a string
        summary: summary ? JSON.stringify(summary) : null,
      },
    });

    await job.progress(PROGRESS.done);

    logger.info('AuditOrchestrator: audit completed', {
      auditId:    ctx.auditId,
      score:      auditScore.overall,
      grade:      auditScore.grade,
      issueCount: auditScore.issueCount,
    });

    return {
      auditId:    ctx.auditId,
      score:      auditScore.overall,
      grade:      auditScore.grade,
      issueCount: auditScore.issueCount,
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Update `status` in DB and report progress to Bull in one step.
   */
  async _setStatus(auditId, status, job, progress) {
    await prisma.seoAudit.update({
      where: { id: auditId },
      data:  { status },
    });
    await job.progress(progress);
    logger.debug(`AuditOrchestrator: → ${status}`, { auditId, progress });
  }

  /**
   * Mark the audit as failed and persist the failure reason.
   * Never throws — DB errors are logged but don't mask the original error.
   *
   * @param {string} auditId
   * @param {string} reason
   */
  async _failAudit(auditId, reason) {
    try {
      await prisma.seoAudit.update({
        where: { id: auditId },
        data:  {
          status:          'failed',
          // Surface the reason in recommendations so the API can return it without
          // knowing about the internal error field — no schema change needed.
          recommendations: [{ error: true, reason }],
        },
      });
    } catch (dbErr) {
      logger.error('AuditOrchestrator: could not persist failed status', {
        auditId,
        reason,
        err: dbErr.message,
      });
    }
  }

  /**
   * Deduplicate and priority-sort recommendations from the issue list.
   *
   * Stored in `recommendations` so the API can surface them without unpacking
   * the full `issues` array (which may be large for 1000-page sites).
   *
   * Dedup key: first 100 chars of the recommendation text — handles CMS-generated
   * recommendations that differ only in page counts at the end.
   *
   * @param {Issue[]} issues  — already sorted critical→low by TechnicalAnalyzer
   * @returns {{ issueId, severity, category, text, autoFixable }[]}
   */
  _extractRecommendations(issues) {
    const seen = new Set();

    return issues
      .filter((i) => i.recommendation)
      .reduce((acc, i) => {
        const key = i.recommendation.slice(0, 100).trim().toLowerCase();
        if (seen.has(key)) return acc;
        seen.add(key);
        acc.push({
          issueId:     i.id,
          severity:    i.severity,
          category:    i.category,
          text:        i.recommendation,
          autoFixable: i.autoFixable,
        });
        return acc;
      }, []);
  }
}

// Singleton — constructor cost is negligible (just two `new` calls)
const orchestrator = new AuditOrchestrator();

module.exports = orchestrator;

// Expose ACTIVE_STATUSES so the controller can use the same constant
// for the duplicate-audit guard without needing a separate import.
module.exports.ACTIVE_STATUSES = ACTIVE_STATUSES;
