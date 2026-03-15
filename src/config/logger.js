'use strict';

/**
 * Structured JSON logger — Pino under the hood, Winston-compatible API.
 *
 * All existing callers use:  logger.info(message, { meta })
 * Pino native API is:        logger.info({ meta }, message)
 *
 * This wrapper bridges the two so zero callers need changing.
 *
 * Context auto-injection (via AsyncLocalStorage):
 *   Every log line automatically includes { traceId, teamId?, jobId?, provider? }
 *   when available in the current async context — no manual threading required.
 *
 * Output:
 *   development → pretty-printed colorized output (pino-pretty)
 *   production  → compact JSON (one line per log entry, structured)
 */

const pino = require('pino');
const als  = require('./als');

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

const transport = isDev
  ? {
      target:  'pino-pretty',
      options: {
        colorize:       true,
        translateTime:  'SYS:yyyy-mm-dd HH:MM:ss',
        ignore:         'pid,hostname',
        messageFormat:  '{msg}',
      },
    }
  : undefined; // production: raw JSON to stdout

const pino_instance = pino({
  level:     isDev ? 'debug' : 'info',
  transport,
  base:      { service: 'adpilot-api' },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Serialize Error objects properly
  serializers: {
    err:   pino.stdSerializers.err,
    error: (e) => (e instanceof Error ? pino.stdSerializers.err(e) : e),
  },
});

/**
 * Build a leveled log function that:
 *  1. Reads ALS store and injects { traceId, teamId, jobId, provider } automatically
 *  2. Merges caller-supplied meta
 *  3. Calls pino with the correct argument order: (mergedMeta, message)
 */
function makeLevel(level) {
  return function log(message, meta) {
    const store   = als.getStore() || {};
    const context = {};

    // Only include ALS fields that have a real value
    if (store.traceId)  context.traceId  = store.traceId;
    if (store.teamId)   context.teamId   = store.teamId;
    if (store.jobId)    context.jobId    = store.jobId;
    if (store.provider) context.provider = store.provider;

    // Handle both calling conventions:
    //   logger.info('message')
    //   logger.info('message', { meta })
    //   logger.info({ meta }, 'message')   ← pino native (also accepted)
    let msgStr;
    let callerMeta;

    if (typeof message === 'string') {
      msgStr     = message;
      callerMeta = (meta && typeof meta === 'object') ? meta : {};
    } else if (typeof message === 'object') {
      // pino-native call: logger.info({ meta }, 'message')
      callerMeta = message;
      msgStr     = (typeof meta === 'string') ? meta : JSON.stringify(message);
    } else {
      msgStr     = String(message);
      callerMeta = {};
    }

    pino_instance[level]({ ...context, ...callerMeta }, msgStr);
  };
}

const logger = {
  trace: makeLevel('trace'),
  debug: makeLevel('debug'),
  info:  makeLevel('info'),
  warn:  makeLevel('warn'),
  error: makeLevel('error'),
  fatal: makeLevel('fatal'),
};

// ── Uncaught exception / rejection handlers ───────────────────────────────────
process.on('uncaughtException', (err) => {
  // Write directly to stderr FIRST — Railway/PaaS log viewers show this clearly
  // even before pino formats the structured JSON output.
  process.stderr.write(`[FATAL] Uncaught exception: ${err.message}\n${err.stack}\n`);
  logger.fatal('Uncaught exception', { err });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  const err = reason instanceof Error ? reason : new Error(String(reason));
  process.stderr.write(`[ERROR] Unhandled promise rejection: ${err.message}\n${err.stack}\n`);
  logger.error('Unhandled promise rejection', { err });
});

module.exports = logger;
