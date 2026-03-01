'use strict';

const featureFlags              = require('../../config/featureFlags');
const logger                    = require('../../config/logger');
const { createNotification }    = require('../../services/notificationHelper');

/**
 * SEO Audit Bull processor.
 *
 * Job data: { teamId, url, auditId? }
 *
 * Routing:
 *   SEO_ENGINE_V2=true  → AuditOrchestrator (v2: Puppeteer + rules + scoring)
 *   SEO_ENGINE_V2=false → SeoAuditService   (legacy: axios + Cheerio)
 *
 * Both paths return: { auditId, score }
 * V2 path also returns: { grade, issueCount }
 */
module.exports = async function seoAuditProcessor(job) {
  const { teamId, url, userId } = job.data;

  if (featureFlags.seoEngine.v2) {
    logger.info('SEO audit job started (v2 engine)', { jobId: job.id, teamId, url });

    const AuditOrchestrator = require('../../services/seo/audit/AuditOrchestrator');
    let result;
    try {
      result = await AuditOrchestrator.run(job);
    } catch (err) {
      if (userId) {
        createNotification(teamId, {
          userId,
          message: `SEO audit for ${url} failed`,
          type: 'error',
        });
      }
      throw err;
    }

    logger.info('SEO audit job done (v2)', {
      jobId:   job.id,
      auditId: result?.auditId,
      score:   result?.score,
      grade:   result?.grade,
    });

    if (userId && result?.score != null) {
      createNotification(teamId, {
        userId,
        message: `SEO audit for ${url} scored ${result.score}/100 (${result.grade ?? ''})`,
        type: 'success',
      });
    }

    return result;
  }

  // ── Legacy path ────────────────────────────────────────────────────────
  logger.info('SEO audit job started (legacy engine)', { jobId: job.id, teamId, url });

  const SeoAuditService = require('../../services/seo/SeoAuditService');
  const audit = await SeoAuditService.audit(teamId, url, job.data.auditId);

  logger.info('SEO audit job done (legacy)', { jobId: job.id, score: audit.overallScore });

  if (userId) {
    createNotification(teamId, {
      userId,
      message: `SEO audit for ${url} scored ${audit.overallScore}/100`,
      type: 'success',
    });
  }

  return { auditId: audit.id, score: audit.overallScore };
};
