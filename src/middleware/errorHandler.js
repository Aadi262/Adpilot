'use strict';

const logger   = require('../config/logger');
const Sentry   = require('../config/sentry');
const AppError = require('../common/AppError');

function normalizeUnexpectedError(err) {
  const message = String(err?.message || '');

  if (/GEMINI_API_KEY|VALUESERP_API_KEY|ANTHROPIC_API_KEY|OPENAI_API_KEY/i.test(message)) {
    return AppError.serviceUnavailable('This feature is not configured on the server yet. Check the deployment environment variables.');
  }

  if (/fetch failed|network error|ECONNREFUSED|ENOTFOUND|EAI_AGAIN|timeout/i.test(message)) {
    return AppError.serviceUnavailable('The upstream AI or search provider is temporarily unavailable. Try again in a moment.');
  }

  if (/non-JSON|JSON parse failed|LLM response missing required fields/i.test(message)) {
    return AppError.serviceUnavailable('The AI provider returned an invalid response. Please try again.');
  }

  if (/overloaded|rate.limit|too many requests|quota exceeded/i.test(message)) {
    return AppError.serviceUnavailable('The AI service is temporarily overloaded. Please try again in a moment.');
  }

  if (/prisma.*timed?\s*out|connection.*pool|prepared statement|P1001|P1002|P1008|P1017/i.test(message)) {
    return AppError.serviceUnavailable('Database connection issue. Please try again.');
  }

  return null;
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  const correlationId = req.correlationId;

  // ── 1. Normalize Prisma known errors into operational AppErrors ────────────
  if (err.code === 'P2002') {
    err = AppError.conflict('A record with that value already exists.');
  } else if (err.code === 'P2025') {
    err = AppError.notFound('Record');
  } else if (err.code === 'P2003') {
    err = AppError.badRequest('Foreign key constraint failed.', 'FK_CONSTRAINT');
  }

  if (!err.isOperational) {
    err = normalizeUnexpectedError(err) || err;
  }

  const statusCode     = err.statusCode || 500;
  const isOperational  = err.isOperational || false;

  // ── 2. Log — errors already tagged with traceId via ALS ───────────────────
  if (!isOperational || statusCode >= 500) {
    logger.error('Unhandled error', {
      correlationId,
      message:  err.message,
      stack:    err.stack,
      url:      req.originalUrl,
      method:   req.method,
      // Avoid logging request body in production to prevent PII leakage
      body: process.env.NODE_ENV !== 'production' ? req.body : undefined,
    });
  }

  // ── 3. Sentry capture for unexpected errors ────────────────────────────────
  // Operational errors (4xx) are expected — do not spam Sentry with them.
  // 5xx errors or non-operational errors indicate a real problem.
  if (!isOperational || statusCode >= 500) {
    Sentry.captureException(err, {
      extra: {
        correlationId,
        url:    req.originalUrl,
        method: req.method,
      },
      user: req.user
        ? { id: req.user.userId, teamId: req.user.teamId }
        : undefined,
    });
  }

  // ── 4. Response ────────────────────────────────────────────────────────────
  return res.status(statusCode).json({
    success: false,
    data:    null,
    error: {
      message: isOperational ? err.message : 'Something went wrong on the server. Please try again.',
      code:    err.code || null,
    },
    meta: { timestamp: new Date().toISOString(), correlationId },
  });
}

module.exports = { errorHandler, AppError };
