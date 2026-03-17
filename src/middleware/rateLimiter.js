'use strict';

const rateLimit = require('express-rate-limit');

const handler = (req, res) => {
  res.status(429).json({
    success: false,
    data: null,
    error: { message: 'Too many requests — please slow down and try again shortly.' },
    meta: { timestamp: new Date().toISOString() },
  });
};

/** General API limiter: 100 req / 15 minutes per IP */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

/** Auth endpoints: 5 attempts / 15 minutes per IP (brute-force protection) */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  skipSuccessfulRequests: true, // only count failed attempts toward limit
});

/** Campaign launch: 10 per hour per user (prevents runaway launches) */
const campaignStartLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
  keyGenerator: (req) => req.user?.id || req.ip,
});

/** Heavy compute endpoints: 20 req / minute */
const heavyLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

module.exports = { apiLimiter, authLimiter, campaignStartLimiter, heavyLimiter };
