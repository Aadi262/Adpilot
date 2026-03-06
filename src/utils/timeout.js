'use strict';

/**
 * Race a promise against a timeout.
 * @param {Promise} promise
 * @param {number}  ms       timeout in milliseconds
 */
function withTimeout(promise, ms) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms)
  );
  return Promise.race([promise, timeout]);
}

module.exports = { withTimeout };
