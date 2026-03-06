'use strict';

// Sentry must be initialized before other requires so it can instrument them.
require('./config/sentry');

const path    = require('path');
const express = require('express');
const helmet  = require('helmet');
const cors    = require('cors');
const Sentry  = require('@sentry/node');

// Infrastructure
const correlationId      = require('./middleware/correlationId');
const sanitize           = require('./middleware/sanitize');
const { apiLimiter }     = require('./middleware/rateLimiter');
const { errorHandler }   = require('./middleware/errorHandler');
const { timingMiddleware } = require('./middleware/timing');
const logger           = require('./config/logger');
const prisma           = require('./config/prisma');
const { getRedis }     = require('./config/redis');
const { queues }       = require('./queues');

// Routes
const healthRoutes            = require('./routes/healthRoutes');
const authRoutes              = require('./routes/authRoutes');
const campaignRoutes          = require('./routes/campaignRoutes');
const adRoutes                = require('./routes/adRoutes');
const analyticsRoutes         = require('./routes/analyticsRoutes');
const seoRoutes               = require('./routes/seoRoutes');
const ruleRoutes              = require('./routes/ruleRoutes');
const integrationRoutes       = require('./routes/integrationRoutes');
const teamRoutes              = require('./routes/teamRoutes');
const notificationRoutes      = require('./routes/notificationRoutes');
const userRoutes              = require('./routes/userRoutes');
const budgetProtectionRoutes  = require('./routes/budgetProtectionRoutes');
const researchRoutes          = require('./routes/researchRoutes');
const competitorRoutes        = require('./routes/competitorRoutes');
const scalingRoutes           = require('./routes/scalingRoutes');
const monitorRoutes           = require('./routes/monitorRoutes');
const pulseRoutes             = require('./routes/pulseRoutes');

const app = express();

// ── Fast liveness check — MUST be first, before all middleware ────────────────
// Railway / Render healthchecks hit /health within 30s of container start.
// Mounting here ensures it responds even if DB/Redis haven't connected yet.
app.use('/health', healthRoutes);

// ── Trust proxy ───────────────────────────────────────────────────────────────
// REQUIRED for Railway / Render / Vercel — ensures req.ip is the real client IP
// and rate limiters work correctly behind reverse proxies.
app.set('trust proxy', 1);

// ── Security ──────────────────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy:     false,
  crossOriginEmbedderPolicy: false,
}));

app.use(cors({
  origin: (origin, callback) => {
    const defaultOrigins = [
      'http://localhost:5173',
      'http://localhost:3000',
      'http://0.0.0.0:3000'
    ];
    const envOrigins = process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : [];

    const allowed = [...defaultOrigins, ...envOrigins];

    // Allow requests with no origin (Postman, curl, server-to-server)
    if (!origin) {
      return callback(null, true);
    }
    // Allow exact matches
    if (allowed.includes(origin)) {
      return callback(null, true);
    }
    // Allow all Vercel preview deployments dynamically
    if (origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }
    logger.warn('CORS blocked request', { origin, allowed });
    return callback(new Error(`CORS: origin ${origin} not allowed`));
  },
  credentials: true,
}));

// ── Request hygiene ───────────────────────────────────────────────────────────
app.use(correlationId);
app.use(express.json({ limit: '1mb' }));

// Catch malformed JSON body before it reaches routes
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') {
    logger.warn('Malformed JSON body rejected', {
      url:    req.originalUrl,
      method: req.method,
      error:  err.message,
    });
    return res.status(400).json({
      success: false,
      data:    null,
      error:   { message: 'Request body contains invalid JSON', detail: err.message },
      meta:    { timestamp: new Date().toISOString() },
    });
  }
  next(err);
});

app.use(sanitize);

// ── Global rate limiter ───────────────────────────────────────────────────────
// trust proxy must be set BEFORE this middleware runs
app.use('/api', apiLimiter);

// ── Response timing (injects responseTime into every JSON response) ──────────
app.use('/api', timingMiddleware);

// ── Request logger ────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  const start = Date.now();

  logger.debug('Incoming request', {
    method: req.method,
    url:    req.originalUrl,
    ip:     req.ip,
  });

  res.on('finish', () => {
    const ms    = Date.now() - start;
    const level = res.statusCode >= 500 ? 'error'
                : res.statusCode >= 400 ? 'warn'
                : 'info';

    logger[level]('HTTP', {
      method: req.method,
      url:    req.originalUrl,
      status: res.statusCode,
      ms,
      ip:     req.ip,
    });

    // Flag slow requests
    if (ms > 3000) {
      logger.warn('SLOW REQUEST detected', {
        method:    req.method,
        url:       req.originalUrl,
        ms,
        threshold: 3000,
      });
    }
  });

  // Detect connections closed before response sent (hanging requests)
  res.on('close', () => {
    if (!res.writableEnded) {
      logger.warn('Connection closed before response was sent', {
        method: req.method,
        url:    req.originalUrl,
        ms:     Date.now() - start,
      });
    }
  });

  next();
});

// ── Static pages (dev only) ───────────────────────────────────────────────────
if (process.env.NODE_ENV !== 'production') {
  const ROOT = path.join(__dirname, '..');
  app.get('/',           (req, res) => res.sendFile(path.join(ROOT, 'index.html')));
  app.get('/login.html', (req, res) => res.sendFile(path.join(ROOT, 'login.html')));
}

// ── Detailed health endpoint (DB + Redis + queues) ───────────────────────────
// Use for monitoring dashboards. NOT used by Railway healthcheck (/health above).
app.get('/health/detailed', async (req, res) => {
  const checks  = {};
  let   overall = 'healthy';

  // Database
  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = { status: 'ok', latencyMs: Date.now() - dbStart };
  } catch (err) {
    logger.error('Health check — database FAILED', {
      message: err.message,
      code:    err.code,
      meta:    err.meta,
      hint:    'Check DATABASE_URL in .env and ensure Docker postgres container is running',
    });
    checks.database = { status: 'fail', error: err.message };
    overall = 'unhealthy';
  }

  // Redis
  const redisStart = Date.now();
  try {
    const redis = getRedis();
    await redis.ping();
    checks.redis = { status: 'ok', latencyMs: Date.now() - redisStart };
  } catch (err) {
    logger.error('Health check — Redis FAILED', {
      message: err.message,
      hint:    'Check REDIS_URL in .env and ensure the Redis container is running',
    });
    checks.redis = { status: 'fail', error: err.message };
    if (overall === 'healthy') overall = 'degraded';
  }

  // Bull queues
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
        if (failed > 50) {
          logger.warn(`Queue "${name}" has accumulated ${failed} failed jobs`, { name, failed });
          queueFailed = true;
        }
      } catch (err) {
        logger.error(`Health check — queue "${name}" FAILED`, {
          message: err.message,
          hint:    'Redis may be unavailable or the queue definition is broken',
        });
        queueChecks[name] = { status: 'fail', error: err.message };
        queueFailed = true;
      }
    })
  );

  checks.queues = queueChecks;
  if (queueFailed && overall === 'healthy') overall = 'degraded';

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
app.use('/api/v1/seo/monitors',  monitorRoutes);
app.use('/api/v1/seo',          seoRoutes);
app.use('/api/v1/rules',        ruleRoutes);
app.use('/api/v1/integrations', integrationRoutes);
app.use('/api/v1/team',          teamRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/users/me',      userRoutes);
app.use('/api/v1/budget-ai',     budgetProtectionRoutes);
app.use('/api/v1/research',      researchRoutes);
app.use('/api/v1/competitors',   competitorRoutes);
app.use('/api/v1/scaling',       scalingRoutes);
app.use('/api/v1/pulse',         pulseRoutes);

// ── Serve React app in production ────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.get('*', (req, res) => res.sendFile(path.join(clientDist, 'index.html')));
}

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  logger.warn('404 not found', {
    method: req.method,
    url:    req.originalUrl,
    ip:     req.ip,
  });
  res.status(404).json({
    success: false,
    data:    null,
    error:   { message: `${req.method} ${req.originalUrl} not found` },
    meta:    { timestamp: new Date().toISOString() },
  });
});

// ── Sentry error handler (must come before custom error handler) ──────────────
Sentry.setupExpressErrorHandler(app);

// ── Global error handler ──────────────────────────────────────────────────────
app.use(errorHandler);

module.exports = app;