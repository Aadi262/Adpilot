'use strict';

const logger = require('../config/logger');

/**
 * Injects responseTime (ms) into every JSON response body under `meta`.
 * Also sets X-Response-Time header and warns on slow requests.
 */
function timingMiddleware(req, res, next) {
  const start = Date.now();

  const originalJson = res.json.bind(res);
  res.json = function (body) {
    const duration = Date.now() - start;
    res.set('X-Response-Time', `${duration}ms`);

    if (duration > 1000) {
      logger.warn('SLOW API', { method: req.method, path: req.path, ms: duration });
    }

    if (body && typeof body === 'object' && !Array.isArray(body)) {
      body.meta = { ...(body.meta || {}), responseTime: duration };
    }

    return originalJson(body);
  };

  next();
}

module.exports = { timingMiddleware };
