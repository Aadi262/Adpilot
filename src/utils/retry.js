'use strict';

/**
 * Retry a function up to `retries` times with exponential backoff.
 * @param {Function} fn
 * @param {object}   opts
 * @param {number}   opts.retries  max extra attempts (default 2)
 * @param {number}   opts.backoff  base delay ms (default 500)
 */
async function withRetry(fn, { retries = 2, backoff = 500 } = {}) {
  let lastError;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < retries) {
        await new Promise(r => setTimeout(r, backoff * (i + 1)));
      }
    }
  }
  throw lastError;
}

module.exports = { withRetry };
