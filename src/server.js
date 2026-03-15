'use strict';

const config = require('./config');
const logger = require('./config/logger');
const prisma = require('./config/prisma');
const app = require('./app');

let server;

const PORT = config.port || process.env.PORT || 3000;
const ENV  = config.nodeEnv || process.env.NODE_ENV || 'development';

// ─── Safety net — log the actual error before exiting ─────────────────────
// This catches anything that slips past our try/catch blocks and prints a
// clear message rather than a silent crash. Keep this as early as possible.
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — shutting down', {
    name:    err.name,
    message: err.message,
    stack:   err.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED PROMISE REJECTION — keeping process alive', {
    reason: reason instanceof Error
      ? { name: reason.name, message: reason.message, stack: reason.stack }
      : String(reason),
  });
  // Don't exit — log and keep running.
});

// ─── Startup ──────────────────────────────────────────────────────────────
async function start() {
  const status = { http: false, db: false, queues: false, jobs: false, pulse: false };

  // ── 1. HTTP server — FATAL if fails ──────────────────────────────────────
  // Start first so Railway's /health check responds immediately, even while
  // DB and Redis are still connecting.
  try {
    await new Promise((resolve, reject) => {
      server = app.listen(PORT, '0.0.0.0', () => resolve());
      server.on('error', reject);
    });
    status.http = true;
    logger.info('HTTP server started ✓', { port: PORT, env: ENV });
  } catch (err) {
    logger.error('FATAL — HTTP server failed to start', {
      message: err.message,
      code:    err.code,
      hint:    err.code === 'EADDRINUSE' ? `Port ${PORT} is already in use` : undefined,
    });
    process.exit(1);
  }

  // ── 2. Database — FATAL if fails ─────────────────────────────────────────
  // Core API cannot function without a DB.
  try {
    await prisma.$connect();
    status.db = true;
    logger.info('Database connected ✓');
  } catch (err) {
    logger.error('FATAL — Database connection failed', {
      message: err.message,
      hint:    'Check DATABASE_URL — must use service hostname in Docker (not localhost)',
    });
    process.exit(1);
  }

  // ── 3. Bull queue processors — NON-FATAL ─────────────────────────────────
  // Redis being down should not take the whole app down. Background jobs
  // will not process, but the API and UI stay functional.
  try {
    const { registerProcessors } = require('./queues');
    registerProcessors();
    status.queues = true;
    logger.info('Queue processors registered ✓');
  } catch (err) {
    logger.warn('Queue processors failed to register — background jobs disabled', {
      message: err.message,
      hint:    'Check REDIS_URL — queues are non-fatal, API continues running',
    });
  }

  // ── 4. Recurring jobs — NON-FATAL ────────────────────────────────────────
  if (status.queues) {
    try {
      const { scheduleRecurringJobs } = require('./queues');
      await scheduleRecurringJobs();
      status.jobs = true;
      logger.info('Recurring jobs scheduled ✓');
    } catch (err) {
      logger.warn('Recurring job scheduling failed — cron jobs disabled', {
        message: err.message,
      });
    }
  }

  // ── 5. Pulse cron — NON-FATAL ────────────────────────────────────────────
  try {
    require('./services/pulse/PulseService').startCron();
    status.pulse = true;
  } catch (err) {
    logger.warn('PulseService cron failed to start (non-fatal)', { message: err.message });
  }

  // ── Startup banner — always printed so Railway/VPS logs show exact state ─
  const tick = (ok) => ok ? '✓' : '✗ (degraded)';
  logger.info('=== AdPilot startup complete ===', {
    http:       tick(status.http),
    database:   tick(status.db),
    queues:     tick(status.queues),
    cronJobs:   tick(status.jobs),
    pulse:      tick(status.pulse),
    port:       PORT,
    env:        ENV,
    node:       process.version,
  });

  console.log(
    `\n  AdPilot API  [${ENV}]  port ${PORT}\n` +
    `  http   ${status.http   ? '✓' : '✗'}\n` +
    `  db     ${status.db     ? '✓' : '✗'}\n` +
    `  queues ${status.queues ? '✓' : '✗ (Redis unavailable — background jobs disabled)'}\n` +
    `  pulse  ${status.pulse  ? '✓' : '✗'}\n`
  );
}

// ─── Graceful shutdown ────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully`);

  const killer = setTimeout(() => {
    logger.error('Shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);

  try {
    if (server) {
      await new Promise((resolve, reject) => server.close((err) => err ? reject(err) : resolve()));
      logger.info('HTTP server closed ✓');
    }
    await prisma.$disconnect();
    logger.info('Database disconnected ✓');
    clearTimeout(killer);
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { message: err.message });
    clearTimeout(killer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();
