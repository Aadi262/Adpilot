'use strict';

/**
 * Thin cache layer — backed by node-cache (in-memory).
 * Drop-in for Redis: swap the implementation here without changing callers.
 *
 * TTL strategy:
 *   AI-generated content  : 30 min  (60 * 30)
 *   Keyword / trend data  : 2 hours (60 * 120)
 *   Competitor analysis   : 1 hour  (60 * 60)
 *   Dashboard metrics     : 5 min   (60 * 5)
 *   Pulse alerts          : 30 sec  (30)
 */

const NodeCache = require('node-cache');

const store = new NodeCache({
  stdTTL:      300,    // default 5 min
  checkperiod: 60,     // GC sweep every 60s
  useClones:   false,  // skip clone for perf
});

const cache = {
  /** @returns {any|null} */
  get(key) {
    return store.get(key) ?? null;
  },

  set(key, value, ttlSeconds = 300) {
    store.set(key, value, ttlSeconds);
  },

  del(key) {
    store.del(key);
  },

  /**
   * Get-or-set: returns { data, cached } so callers know provenance.
   * @param {string}   key
   * @param {Function} fetchFn  async function that returns the fresh value
   * @param {number}   ttl      seconds
   */
  async getOrSet(key, fetchFn, ttl = 300) {
    const hit = store.get(key);
    if (hit !== undefined) return { data: hit, cached: true };

    const fresh = await fetchFn();
    store.set(key, fresh, ttl);
    return { data: fresh, cached: false };
  },

  /** Invalidate all keys matching a prefix. */
  delByPrefix(prefix) {
    const keys = store.keys().filter(k => k.startsWith(prefix));
    if (keys.length) store.del(keys);
    return keys.length;
  },

  stats() {
    return store.getStats();
  },
};

module.exports = cache;
