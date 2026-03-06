'use strict';

const config = require('./config');
const logger = require('./config/logger');
const prisma = require('./config/prisma');
const app = require('./app');
const { registerProcessors, scheduleRecurringJobs } = require('./queues');

let server;

const PORT = config.port || process.env.PORT || 3000;
const ENV = config.nodeEnv || process.env.NODE_ENV || 'development';

// ─── Unhandled rejection / exception safety net ───────────────────────────
process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION — process will exit', {
    message: err.message,
    stack: err.stack,
    name: err.name,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('UNHANDLED PROMISE REJECTION', {
    reason: reason instanceof Error
      ? { message: reason.message, stack: reason.stack, name: reason.name }
      : reason,
    promise: String(promise),
  });
  // Don't exit — log it and keep running, but flag it clearly
});

// ─── Startup ──────────────────────────────────────────────────────────────
async function start() {
  logger.info('Starting AdPilot API...', { port: PORT, env: ENV });

  // 1. HTTP server FIRST — Railway/Render healthchecks hit /health within 30s.
  //    Binding before DB/Redis ensures the liveness endpoint responds immediately
  //    even while infrastructure connections are still being established.
  try {
    await new Promise((resolve, reject) => {
      server = app.listen(PORT, '0.0.0.0', () => {
        logger.info('Server started ✓', { port: PORT, env: ENV });
        console.log(
          `\n🚀 AdPilot API running on http://0.0.0.0:${PORT} [${ENV}]\n` +
          `   Health:    http://localhost:${PORT}/health\n` +
          `   Auth:      http://localhost:${PORT}/api/v1/auth/login\n` +
          `   Campaigns: http://localhost:${PORT}/api/v1/campaigns\n`
        );
        resolve();
      });

      server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          logger.error(`HTTP SERVER ERROR — Port ${PORT} is already in use`, {
            code: err.code,
            port: PORT,
            hint: `Run: lsof -ti tcp:${PORT} | xargs kill -9`,
          });
        } else {
          logger.error('HTTP SERVER ERROR', {
            message: err.message,
            code: err.code,
            stack: err.stack,
          });
        }
        reject(err);
      });
    });
  } catch (err) {
    logger.error('FAILED TO START HTTP SERVER', {
      message: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }

  // 2. Database — connect after HTTP is already accepting requests
  try {
    logger.info('Connecting to PostgreSQL...');
    await prisma.$connect();
    logger.info('Database connected ✓');
  } catch (err) {
    logger.error('DATABASE CONNECTION FAILED', {
      message: err.message,
      code: err.code,
      meta: err.meta,
      stack: err.stack,
      hint: 'Check DATABASE_URL in .env and make sure the DB is reachable',
    });
    process.exit(1);
  }

  // 3. Bull queue processors
  try {
    logger.info('Registering Bull queue processors...');
    registerProcessors();
    logger.info('Queue processors registered ✓');
  } catch (err) {
    logger.error('QUEUE PROCESSOR REGISTRATION FAILED', {
      message: err.message,
      stack: err.stack,
      hint: 'Check Redis connection — REDIS_URL in .env',
    });
    process.exit(1);
  }

  // 4. Recurring jobs
  try {
    logger.info('Scheduling recurring jobs...');
    await scheduleRecurringJobs();
    logger.info('Recurring jobs scheduled ✓');
  } catch (err) {
    logger.error('RECURRING JOB SCHEDULING FAILED', {
      message: err.message,
      stack: err.stack,
      hint: 'Redis may be unavailable or a job definition is broken',
    });
    process.exit(1);
  }

  // 5. Pulse cron (every 15 min — non-fatal if fails)
  try {
    require('./services/pulse/PulseService').startCron();
  } catch (err) {
    logger.warn('PulseService cron start failed (non-fatal)', { message: err.message });
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────
async function shutdown(signal) {
  logger.info(`${signal} received — shutting down gracefully...`);

  const TIMEOUT = 10_000; // 10s hard kill
  const killer = setTimeout(() => {
    logger.error('Shutdown timed out after 10s — forcing exit');
    process.exit(1);
  }, TIMEOUT);

  try {
    if (server) {
      await new Promise((resolve, reject) => {
        server.close((err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      logger.info('HTTP server closed ✓');
    }

    await prisma.$disconnect();
    logger.info('Database disconnected ✓');

    clearTimeout(killer);
    logger.info('Shutdown complete');
    process.exit(0);

  } catch (err) {
    logger.error('ERROR DURING SHUTDOWN', {
      message: err.message,
      stack: err.stack,
    });
    clearTimeout(killer);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

start();