'use strict';

const config = require('./config');
const logger = require('./config/logger');
const prisma = require('./config/prisma');
const app = require('./app');
const { registerProcessors, scheduleRecurringJobs } = require('./queues');

let server;

const PORT = config.port || process.env.PORT || 3000;

async function start() {
  try {
    // 1️⃣ Verify database connection
    await prisma.$connect();
    logger.info('Database connected');

    // 2️⃣ Activate Bull queue processors
    registerProcessors();

    // 3️⃣ Schedule recurring jobs
    await scheduleRecurringJobs();

    // 4️⃣ Start HTTP server
    server = app.listen(PORT, () => {
      logger.info('Server started', {
        port: PORT,
        env: config.nodeEnv || process.env.NODE_ENV || 'development'
      });

      console.log(
        `\n🚀 AdPilot API running on http://localhost:${PORT} [${
          config.nodeEnv || process.env.NODE_ENV || 'development'
        }]\n`
      );
    });

    // Handle server-level errors
    server.on('error', (err) => {
      logger.error('HTTP server error', { error: err.message });
      process.exit(1);
    });

  } catch (err) {
    logger.error('Failed to start server', { error: err.message });
    process.exit(1);
  }
}

async function shutdown(signal) {
  logger.info(`${signal} received – shutting down gracefully`);

  try {
    if (server) {
      server.close(async () => {
        logger.info('HTTP server closed');
        await prisma.$disconnect();
        logger.info('Database disconnected');
        process.exit(0);
      });
    } else {
      await prisma.$disconnect();
      process.exit(0);
    }
  } catch (err) {
    logger.error('Error during shutdown', { error: err.message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start();