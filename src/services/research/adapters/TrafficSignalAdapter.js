'use strict';

// Do NOT require config/env here — it validates ALL env vars (JWT, encryption, etc.)
// and throws on startup if any are missing. Use process.env directly for the
// optional keys this adapter needs.
const logger = require('../../../config/logger');
const { getRedis } = require('../../../config/redis');

const env = {
  get CLOUDFLARE_API_TOKEN()  { return process.env.CLOUDFLARE_API_TOKEN  || ''; },
  get CLOUDFLARE_ACCOUNT_ID() { return process.env.CLOUDFLARE_ACCOUNT_ID || ''; },
  get SIMILARWEB_API_KEY()    { return process.env.SIMILARWEB_API_KEY    || ''; },
};

const TTL_SECONDS = 60 * 30;

class TrafficSignalAdapter {
  async analyze(domain) {
    const cleanDomain = String(domain || '').replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].trim();
    const cacheKey = `research:traffic-signals:${cleanDomain}`;
    const redis = getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {
      // Cache read failure is non-fatal.
    }

    const [cloudflare, similarweb] = await Promise.allSettled([
      this._fetchCloudflareRadar(cleanDomain),
      this._fetchSimilarwebRank(cleanDomain),
    ]);

    const result = this._mergeSignals({
      domain: cleanDomain,
      cloudflare: cloudflare.status === 'fulfilled' ? cloudflare.value : this._providerUnavailable('cloudflare_radar', cloudflare.reason),
      similarweb: similarweb.status === 'fulfilled' ? similarweb.value : this._providerUnavailable('similarweb_digitalrank', similarweb.reason),
    });

    try {
      await redis.setex(cacheKey, TTL_SECONDS, JSON.stringify(result));
    } catch (_) {
      // Cache write failure is non-fatal.
    }

    return result;
  }

  async _fetchCloudflareRadar(domain) {
    if (!env.CLOUDFLARE_API_TOKEN || !env.CLOUDFLARE_ACCOUNT_ID) {
      return {
        source: 'cloudflare_radar',
        status: 'missing_key',
        confidence: 'none',
        freshness: 'live',
        message: 'Cloudflare Radar token is not configured.',
        metrics: {},
      };
    }

    try {
      const response = await fetch(
        `https://api.cloudflare.com/client/v4/radar/ranking/top/domains?format=json&limit=1000&name=${encodeURIComponent(domain)}`,
        {
          headers: {
            Authorization: `Bearer ${env.CLOUDFLARE_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
          signal: AbortSignal.timeout(12000),
        }
      );

      if (!response.ok) {
        return {
          source: 'cloudflare_radar',
          status: response.status === 401 || response.status === 403 ? 'auth_failed' : 'unavailable',
          confidence: 'none',
          freshness: 'live',
          message: `Cloudflare Radar request failed with ${response.status}.`,
          metrics: {},
        };
      }

      const payload = await response.json();
      const rows = payload?.result?.top_0 || payload?.result?.domains || payload?.result || [];
      const match = Array.isArray(rows)
        ? rows.find((row) => {
            const name = String(row.domain || row.name || '').replace(/^www\./i, '');
            return name === domain;
          })
        : null;

      return {
        source: 'cloudflare_radar',
        status: match ? 'ok' : 'partial',
        confidence: match ? 'medium' : 'low',
        freshness: 'live',
        message: match
          ? `Cloudflare Radar returned a domain popularity rank for ${domain}.`
          : `Cloudflare Radar did not return a direct rank match for ${domain}.`,
        metrics: match ? {
          globalRank: match.rank ?? null,
          categoryRank: match.rank ?? null,
        } : {},
      };
    } catch (err) {
      logger.debug('TrafficSignalAdapter: Cloudflare Radar failed', { domain, err: err.message });
      return {
        source: 'cloudflare_radar',
        status: 'unavailable',
        confidence: 'none',
        freshness: 'live',
        message: `Cloudflare Radar request failed: ${err.message}`,
        metrics: {},
      };
    }
  }

  async _fetchSimilarwebRank(domain) {
    if (!env.SIMILARWEB_API_KEY) {
      return {
        source: 'similarweb_digitalrank',
        status: 'missing_key',
        confidence: 'none',
        freshness: 'live',
        message: 'Similarweb API key is not configured.',
        metrics: {},
      };
    }

    try {
      const response = await fetch(
        `https://api.similarweb.com/v1/website/${encodeURIComponent(domain)}/digital-rank/overview?api_key=${encodeURIComponent(env.SIMILARWEB_API_KEY)}&granularity=monthly&main_domain_only=false`,
        {
          signal: AbortSignal.timeout(12000),
        }
      );

      if (!response.ok) {
        return {
          source: 'similarweb_digitalrank',
          status: response.status === 401 || response.status === 403 ? 'auth_failed' : 'unavailable',
          confidence: 'none',
          freshness: 'live',
          message: `Similarweb request failed with ${response.status}.`,
          metrics: {},
        };
      }

      const payload = await response.json();
      const rank = payload?.digital_rank?.rank ?? payload?.rank ?? payload?.visits_rank ?? null;

      return {
        source: 'similarweb_digitalrank',
        status: rank ? 'ok' : 'partial',
        confidence: rank ? 'medium' : 'low',
        freshness: 'live',
        message: rank
          ? `Similarweb returned a DigitalRank signal for ${domain}.`
          : `Similarweb returned a response but no DigitalRank value for ${domain}.`,
        metrics: rank ? {
          globalRank: rank,
          countryRank: payload?.country_rank ?? null,
          categoryRank: payload?.category_rank ?? null,
        } : {},
      };
    } catch (err) {
      logger.debug('TrafficSignalAdapter: Similarweb failed', { domain, err: err.message });
      return {
        source: 'similarweb_digitalrank',
        status: 'unavailable',
        confidence: 'none',
        freshness: 'live',
        message: `Similarweb request failed: ${err.message}`,
        metrics: {},
      };
    }
  }

  _mergeSignals({ domain, cloudflare, similarweb }) {
    const providers = [cloudflare, similarweb];
    const ranks = providers
      .map((provider) => provider.metrics?.globalRank)
      .filter((value) => Number.isFinite(Number(value)))
      .map(Number)
      .sort((a, b) => a - b);

    const bestRank = ranks[0] ?? null;
    const confidence = bestRank
      ? providers.some((provider) => provider.status === 'ok')
        ? 'medium'
        : 'low'
      : 'low';

    return {
      domain,
      summary: {
        bestKnownGlobalRank: bestRank,
        confidence,
        available: bestRank != null,
      },
      providers,
      evidence: providers
        .filter((provider) => provider.metrics && Object.keys(provider.metrics).length > 0)
        .map((provider) => `${provider.source} reported rank ${provider.metrics.globalRank}.`),
    };
  }

  _providerUnavailable(source, reason) {
    return {
      source,
      status: 'unavailable',
      confidence: 'none',
      freshness: 'live',
      message: reason?.message || `${source} is unavailable.`,
      metrics: {},
    };
  }
}

module.exports = new TrafficSignalAdapter();
