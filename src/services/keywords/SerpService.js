'use strict';

const logger        = require('../../config/logger');
const googleScraper = require('./GoogleScraper');
const serpProvider  = require('../seo/SerpProviderService');

/**
 * SerpService — Keyword rank tracking with 3-tier fallback.
 *
 * Priority:
 *   1. ValueSERP API     — most accurate (Google), free 50/month
 *      Get key: https://www.valueserp.com/
 *   2. DuckDuckGo HTML   — free, no key, no limit (built-in fallback)
 *   3. Mock drift        — ±3 from seeded starting position (last resort)
 */
class SerpService {
  get hasValueSerp() {
    return serpProvider.isAvailable;
  }

  /**
   * Get rank for a keyword + domain.
   * Tries ValueSERP → DuckDuckGo scraper → returns { isReal: false } as last resort.
   *
   * Returns: { position: number|null, url, title, isReal, source }
   */
  async getRank(keyword, targetDomain) {
    // 1. ValueSERP (accurate Google results)
    if (this.hasValueSerp) {
      const result = await this._valueSerp(keyword, targetDomain);
      if (result.isReal !== false) return result;
    }

    // 2. DuckDuckGo HTML scraper (free, no key)
    const ddgResult = await googleScraper.getRank(keyword, targetDomain);
    if (ddgResult.isReal) return ddgResult;

    // 3. No real data available
    return { position: null, url: null, title: null, isReal: false, source: 'none' };
  }

  /**
   * Bulk rank check.
   * Adds delay between requests to be polite to free services.
   */
  async getRanks(keywords, targetDomain) {
    const results = [];
    for (const kw of keywords) {
      const rank = await this.getRank(kw, targetDomain);
      results.push({ keyword: kw, ...rank });
      // 1.1s between requests — safe for ValueSERP free tier and DDG
      await new Promise(r => setTimeout(r, 1100));
    }
    return results;
  }

  /**
   * ValueSERP API call (Google results, most accurate).
   */
  async _valueSerp(keyword, targetDomain) {
    try {
      const result = await serpProvider.search(keyword, { num: 50 });
      const data = result.data;
      if (!data) {
        logger.warn('SerpService._valueSerp unavailable', {
          keyword,
          status: result.providerStatus?.status,
          source: result.providerStatus?.source,
        });
        return {
          position: null,
          url: null,
          title: null,
          isReal: false,
          source: 'valueserp',
          providerStatus: result.providerStatus || null,
        };
      }

      const results = data?.organic_results ?? [];

      const cleanTarget = targetDomain
        .replace(/^(https?:\/\/)?(www\.)?/, '')
        .replace(/\/$/, '');

      const match = results.find(r => {
        const rd = (r.domain || r.link || '')
          .replace(/^(https?:\/\/)?(www\.)?/, '')
          .replace(/\/$/, '');
        return rd.includes(cleanTarget) || cleanTarget.includes(rd.split('/')[0]);
      });

      return match
        ? {
            position: match.position,
            url: match.link,
            title: match.title,
            isReal: true,
            source: 'valueserp',
            providerStatus: result.providerStatus || null,
          }
        : {
            position: null,
            url: null,
            title: null,
            isReal: true,
            source: 'valueserp',
            providerStatus: result.providerStatus || null,
          };
    } catch (err) {
      logger.error('SerpService._valueSerp failed', { keyword, error: err.message });
      return {
        position: null,
        url: null,
        title: null,
        isReal: false,
        source: 'valueserp',
        providerStatus: null,
      };
    }
  }
}

module.exports = new SerpService();
