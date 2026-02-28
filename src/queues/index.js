'use strict';

const { randomUUID } = require('crypto');
const Bull   = require('bull');
const config = require('../config');
const logger = require('../config/logger');
const als    = require('../config/als');

const REDIS_URL = config.redis.url;

const DEFAULT_JOB_OPTIONS = {
  attempts:         3,
  backoff:          { type: 'exponential', delay: 5_000 },
  removeOnComplete: 50,
  removeOnFail:     100,
};

/** Factory — create or retrieve a named queue */
function createQueue(name) {
  const queue = new Bull(name, REDIS_URL, {
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  queue.on('failed', (job, err) => {
    logger.error(`Queue [${name}] job failed`, { jobId: job.id, attempt: job.attemptsMade, error: err.message });
  });

  queue.on('completed', (job) => {
    logger.debug(`Queue [${name}] job completed`, { jobId: job.id });
  });

  return queue;
}

/**
 * Wrap a Bull processor function with an AsyncLocalStorage context.
 *
 * Every log call made within the processor (and any services it calls)
 * will automatically include { traceId, jobId } — without any manual threading.
 *
 * traceId is set to the Bull job ID so log lines can be correlated to a specific
 * queue job across the entire service call tree.
 *
 * Additional context fields (teamId, provider) can be stamped onto the mutable
 * store inside the processor:  als.getStore().teamId = job.data.teamId
 */
function withContext(processor) {
  return async function contextWrappedProcessor(job) {
    const traceId = `job-${job.id}`;
    const store   = { traceId, jobId: String(job.id) };

    return als.run(store, async () => {
      // Stamp extra context from job data if available
      if (job.data?.teamId)   store.teamId   = job.data.teamId;
      if (job.data?.provider) store.provider = job.data.provider;

      return processor(job);
    });
  };
}

// Named queues — each isolated for retry/priority tuning
const queues = {
  seoAudit:         createQueue('seo-audit'),
  keywordSync:      createQueue('keyword-sync'),
  ruleEvaluation:   createQueue('rule-evaluation'),
  analyticsRefresh: createQueue('analytics-refresh'),
  integrationSync:  createQueue('integration-sync'),
  notifications:    createQueue('notifications'),
  tokenHealthCheck: createQueue('token-health-check'),
};

// Register processors — each wrapped in ALS context
function registerProcessors() {
  queues.seoAudit.process(1,         withContext(require('./processors/seoAuditProcessor')));
  queues.keywordSync.process(2,      withContext(require('./processors/keywordSyncProcessor')));
  queues.ruleEvaluation.process(5,   withContext(require('./processors/ruleEvaluationProcessor')));
  queues.analyticsRefresh.process(2, withContext(require('./processors/analyticsRefreshProcessor')));
  queues.integrationSync.process(2,  withContext(require('./processors/integrationSyncProcessor')));
  queues.notifications.process(10,   withContext(require('./processors/notificationsProcessor')));
  queues.tokenHealthCheck.process(1, withContext(require('./processors/tokenHealthCheckProcessor')));
  logger.info('Queue processors registered');
}

/**
 * Schedule the token health check as a Bull repeating cron job.
 * Bull deduplicates repeating jobs by their cron pattern — safe to call on every startup.
 * Runs daily at 02:00 UTC.
 */
async function scheduleRecurringJobs() {
  await queues.tokenHealthCheck.add(
    {},
    {
      repeat:           { cron: '0 2 * * *', tz: 'UTC' },
      jobId:            'token-health-check-daily',
      removeOnComplete: 1,
      removeOnFail:     5,
    }
  );
  logger.info('Recurring jobs scheduled: token-health-check (daily 02:00 UTC)');
}

module.exports = { queues, registerProcessors, scheduleRecurringJobs };
