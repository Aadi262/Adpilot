'use strict';

const featureFlags    = require('../../config/featureFlags');
const logger          = require('../../config/logger');

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
  const { teamId, url } = job.data;

  if (featureFlags.seoEngine.v2) {
    logger.info('SEO audit job started (v2 engine)', { jobId: job.id, teamId, url });

    // Lazy-require to avoid loading Puppeteer when v2 is disabled
    const AuditOrchestrator = require('../../services/seo/audit/AuditOrchestrator');
    const result = await AuditOrchestrator.run(job);

    logger.info('SEO audit job done (v2)', {
      jobId:  job.id,
      auditId: result?.auditId,
      score:   result?.score,
      grade:   result?.grade,
    });

    return result;
  }

  // ── Legacy path ──────────────────────────────────────────────────────────

logger.info('SEO audit job started (legacy engine)', { jobId: job.id, teamId, url });

const SeoAuditService = require('../../services/seo/SeoAuditService');

// Pass auditId so the service updates the existing record instead of creating a new one
const audit = await SeoAuditService.audit(teamId, url, job.data.auditId);

logger.info('SEO audit job done (legacy)', { jobId: job.id, score: audit.overallScore });
return { auditId: audit.id, score: audit.overallScore };
}