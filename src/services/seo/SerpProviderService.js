'use strict';

const crypto = require('crypto');

const logger = require('../../config/logger');
const { getRedis } = require('../../config/redis');

const RESPONSE_CACHE_TTL_SECONDS = 6 * 60 * 60;
const COOLDOWN_TTLS = {
  quota_exhausted: 30 * 60,
  auth_error: 15 * 60,
  rate_limited: 5 * 60,
  http_error: 90,
};

class SerpProviderService {
  constructor() {
    this.apiKey = process.env.VALUESERP_API_KEY || null;
    this.baseUrl = 'https://api.valueserp.com/search';
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  _hash(value) {
    return crypto.createHash('sha1').update(String(value || '')).digest('hex');
  }

  _resultCacheKey(payload) {
    return `serp:valueserp:result:${this._hash(JSON.stringify(payload))}`;
  }

  _cooldownKey() {
    return 'serp:valueserp:cooldown';
  }

  async _readJSON(key) {
    try {
      const redis = getRedis();
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      logger.debug('SerpProviderService: cache read skipped', { message: err.message });
      return null;
    }
  }

  async _writeJSON(key, value, ttlSeconds) {
    try {
      const redis = getRedis();
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.debug('SerpProviderService: cache write skipped', { message: err.message });
    }
  }

  async _deleteKey(key) {
    try {
      const redis = getRedis();
      await redis.del(key);
    } catch (err) {
      logger.debug('SerpProviderService: cache delete skipped', { message: err.message });
    }
  }

  _buildStatus(status, overrides = {}) {
    const messages = {
      ok: 'ValueSERP responded successfully.',
      missing_key: 'ValueSERP API key is not configured on this server.',
      quota_exhausted: 'ValueSERP quota is exhausted or billing is blocked. Live SERP enrichment is temporarily unavailable.',
      auth_error: 'ValueSERP rejected the current API key. Check the production API credentials.',
      rate_limited: 'ValueSERP rate limit was hit. The app is cooling down before retrying.',
      http_error: 'ValueSERP returned an unexpected HTTP error.',
      timeout: 'ValueSERP timed out before returning SERP data.',
      network_error: 'ValueSERP could not be reached from this server.',
      degraded_cache: 'Live SERP enrichment is degraded, so cached ValueSERP data is being reused.',
      unavailable: 'Live SERP enrichment is currently unavailable.',
    };

    return {
      provider: 'valueserp',
      configured: !!this.apiKey,
      status,
      degraded: status !== 'ok',
      message: messages[status] || messages.unavailable,
      ...overrides,
    };
  }

  _cooldownStatusForHttp(statusCode) {
    if (statusCode === 402) return 'quota_exhausted';
    if (statusCode === 401 || statusCode === 403) return 'auth_error';
    if (statusCode === 429) return 'rate_limited';
    return 'http_error';
  }

  _cooldownTtl(status) {
    return COOLDOWN_TTLS[status] || COOLDOWN_TTLS.http_error;
  }

  _paramsFor(query, options = {}) {
    const {
      num = 10,
      location = 'India',
      gl = 'in',
      hl = 'en',
    } = options;

    return {
      api_key: this.apiKey,
      q: query,
      location,
      google_domain: gl === 'in' ? 'google.co.in' : 'google.com',
      gl,
      hl,
      num: String(num),
      output: 'json',
    };
  }

  async _setCooldown(status, httpStatus) {
    const ttlSeconds = this._cooldownTtl(status);
    const until = new Date(Date.now() + (ttlSeconds * 1000)).toISOString();
    const cooldown = this._buildStatus(status, {
      httpStatus,
      source: 'cooldown',
      degraded: true,
      cooldownUntil: until,
      cooldownSeconds: ttlSeconds,
    });
    await this._writeJSON(this._cooldownKey(), cooldown, ttlSeconds);
    return cooldown;
  }

  async search(query, options = {}) {
    const cleanQuery = String(query || '').trim();
    if (!cleanQuery) {
      return {
        data: null,
        providerStatus: this._buildStatus('unavailable', {
          source: 'validation',
          message: 'SERP enrichment requires a non-empty query.',
        }),
        cached: false,
      };
    }

    if (!this.apiKey) {
      return {
        data: null,
        providerStatus: this._buildStatus('missing_key', {
          source: 'disabled',
          degraded: true,
        }),
        cached: false,
      };
    }

    const params = this._paramsFor(cleanQuery, options);
    const resultCacheKey = this._resultCacheKey(params);

    const [cooldown, cachedEntry] = await Promise.all([
      this._readJSON(this._cooldownKey()),
      this._readJSON(resultCacheKey),
    ]);

    if (cooldown?.cooldownUntil && new Date(cooldown.cooldownUntil).getTime() > Date.now()) {
      if (cachedEntry?.data) {
        return {
          data: cachedEntry.data,
          providerStatus: this._buildStatus('degraded_cache', {
            source: 'cache',
            degraded: true,
            upstreamStatus: cooldown.status,
            cooldownUntil: cooldown.cooldownUntil,
            cachedAt: cachedEntry.fetchedAt,
            httpStatus: cooldown.httpStatus || null,
          }),
          cached: true,
        };
      }

      return {
        data: null,
        providerStatus: cooldown,
        cached: false,
      };
    }

    if (cachedEntry?.data) {
      return {
        data: cachedEntry.data,
        providerStatus: this._buildStatus('ok', {
          source: 'cache',
          degraded: false,
          cachedAt: cachedEntry.fetchedAt,
        }),
        cached: true,
      };
    }

    try {
      const searchParams = new URLSearchParams(params);
      const res = await fetch(`${this.baseUrl}?${searchParams}`, { signal: AbortSignal.timeout(15000) });

      if (!res.ok) {
        const status = this._cooldownStatusForHttp(res.status);
        logger.warn('SerpProviderService.search failed', { query: cleanQuery, status: res.status });
        const providerStatus = await this._setCooldown(status, res.status);
        return { data: null, providerStatus, cached: false };
      }

      const data = await res.json();
      const fetchedAt = new Date().toISOString();

      await Promise.all([
        this._writeJSON(resultCacheKey, { data, fetchedAt }, RESPONSE_CACHE_TTL_SECONDS),
        this._deleteKey(this._cooldownKey()),
      ]);

      return {
        data,
        providerStatus: this._buildStatus('ok', {
          source: 'live',
          degraded: false,
          cachedAt: fetchedAt,
          httpStatus: 200,
        }),
        cached: false,
      };
    } catch (err) {
      const timeoutLike = err?.name === 'TimeoutError' || /timed out|aborted/i.test(err?.message || '');
      const status = timeoutLike ? 'timeout' : 'network_error';

      logger.warn('SerpProviderService.search error', {
        query: cleanQuery,
        message: err.message,
        status,
      });

      return {
        data: null,
        providerStatus: this._buildStatus(status, {
          source: 'live',
          degraded: true,
        }),
        cached: false,
      };
    }
  }
}

module.exports = new SerpProviderService();
