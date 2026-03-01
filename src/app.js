'use strict';

// Sentry must be initialized before other requires so it can instrument them.
require('./config/sentry');

const path    = require('path');
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const Sentry  = require('@sentry/node');

// Infrastructure
const correlationId  = require('./middleware/correlationId');
const sanitize       = require('./middleware/sanitize');
const { apiLimiter } = require('./middleware/rateLimiter');
const { errorHandler } = require('./middleware/errorHandler');
const logger         = require('./config/logger');
const prisma         = require('./config/prisma');
const { getRedis }   = require('./config/redis');
const { queues }     = require('./queues');

// Routes
const authRoutes        = require('./routes/authRoutes');
const campaignRoutes    = require('./routes/campaignRoutes');
const adRoutes          = require('./routes/adRoutes');
const analyticsRoutes   = require('./routes/analyticsRoutes');
const seoRoutes         = require('./routes/seoRoutes');
const ruleRoutes        = require('./routes/ruleRoutes');
const integrationRoutes = require('./routes/integrationRoutes');
const teamRoutes        = require('./routes/teamRoutes');

const app = express();

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy:     false,
  crossOriginEmbedderPolicy: false,
}));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));

// ── Request hygiene ───────────────────────────────────────────────────────────
app.use(correlationId);        // also starts ALS context with traceId
app.use(express.json({ limit: '1mb' }));
app.use(sanitize);

// ── Global rate limiter ───────────────────────────────────────────────────────
app.use('/api', apiLimiter);

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    // traceId and teamId are already in ALS — logger injects them automatically
    logger.info('HTTP', {
      method: req.method,
      url:    req.originalUrl,
      status: res.statusCode,
      ms:     Date.now() - start,
    });
  });
  next();
});

// ── Static pages (dev only — in production the frontend is on Vercel) ────────
if (process.env.NODE_ENV !== 'production') {
  const ROOT = path.join(__dirname, '..');
  app.get('/',           (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
  app.get('/login.html', (req, res) => res.sendFile(path.join(ROOT, 'login.html')));
}

// ── Health endpoint ───────────────────────────────────────────────────────────
app.get('/health', async (req, res) => {
  const checks  = {};
  let   overall = 'healthy';

  // ── Database ────────────────────────────────────────────────────────────
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    checks.database = { status: 'fail', error: err.message };
    overall = 'unhealthy';
  }

  // ── Redis ────────────────────────────────────────────────────────────────
  const redisStart = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
  } catch (err) {
    checks.redis = { status: 'fail', error: err.message };
    if (overall === 'healthy') overall = 'degraded';
  }

  // ── Bull queues ──────────────────────────────────────────────────────────
  const queueChecks = {};
  let   queueFailed = false;

  await Promise.allSettled(
    Object.entries(queues).map(async ([name, queue]) => {
      try {
        const [waiting, active, failed, delayed] = await Promise.all([
          queue.getWaitingCount(),
          queue.getActiveCount(),
          queue.getFailedCount(),
          queue.getDelayedCount(),
        ]);
        queueChecks[name] = { status: 'ok', waiting, active, failed, delayed };
        // Flag if a queue has accumulated significant failures
        if (failed > 50) queueFailed = true;
      } catch (err) {
        queueChecks[name] = { status: 'fail', error: err.message };
        queueFailed = true;
      }
    })
  );

  checks.queues = queueChecks;
  if (queueFailed && overall === 'healthy') overall = 'degraded';

  // ── Response ─────────────────────────────────────────────────────────────
  const statusCode = overall === 'unhealthy' ? 503 : 200;

  return res.status(statusCode).json({
    success: overall !== 'unhealthy',
    data: {
      status:    overall,
      timestamp: new Date().toISOString(),
      uptime:    Math.floor(process.uptime()),
      checks,
    },
    error: null,
    meta:  {},
  });
});

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/v1/auth',         authRoutes);
app.use('/api/v1/campaigns',    campaignRoutes);
app.use('/api/v1',              adRoutes);
app.use('/api/v1/analytics',    analyticsRoutes);
app.use('/api/v1/seo',          seoRoutes);
app.use('/api/v1/rules',        ruleRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/team',         teamRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    success: false,
    data:    null,
    error:   { message: `${req.method} ${req.originalUrl} not found` },
    meta:    { timestamp: new Date().toISOString() },
  });
});

// ── Sentry error handler (must come before custom error handler) ──────────────
// Captures exceptions that weren't already captured by the error handler itself.
Sentry.setupExpressErrorHandler(app);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;
