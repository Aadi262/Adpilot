'use strict';

const { randomUUID } = require('crypto');
const als            = require('../config/als');

/**
 * Attaches a unique trace ID to every request and starts an AsyncLocalStorage
 * context so all logger calls within this request automatically include traceId.
 *
 * Propagation:
 *   - Accepts X-Correlation-Id from upstream (e.g. API gateway) to preserve trace continuity
 *   - Falls back to a new UUID for origin requests
 *
 * ALS store shape: { traceId, teamId: null }
 *   teamId is null at this point — stamped by auth middleware after token is decoded.
 *   Because the store is a plain object (reference type), downstream middleware can
 *   mutate it:  als.getStore().teamId = req.user.teamId
 */
function correlationId(req, res, next) {
  const traceId = req.headers['x-correlation-id'] || randomUUID();

  req.correlationId = traceId;
  res.setHeader('X-Correlation-Id', traceId);

  // Run the entire request lifecycle inside this ALS context.
  // next() is called inside als.run() so the async chain inherits the store.
  als.run({ traceId, teamId: null }, next);
}

module.exports = correlationId;
