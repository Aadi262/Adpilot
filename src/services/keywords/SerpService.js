'use strict';

const logger = require('../../config/logger');

/**
 * SerpService — Google rank tracking via ValueSERP API.
 *
 * Free tier: 50 searches/month (no credit card required).
 * Get key: https://www.valueserp.com/
 *
 * When VALUESERP_API_KEY is not set, all methods return { isReal: false }
 * so callers can fall back to the existing mock rank drift.
 */
class SerpService {
  constructor() {
    this.apiKey  = process.env.VALUESERP_API_KEY || null;
    this.baseUrl = 'https://api.valueserp.com/search';
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Get real Google rank for a keyword + domain.
   * Returns: { position, url, title, isReal }
   *
   * position is null if domain not found in top 50 results.
   */
  async getRank(keyword, targetDomain) {
    if (!this.apiKey) {
      return { position: null, url: null, title: null, isReal: false };
    }

    try {
      const params = new URLSearchParams({
        api_key:       this.apiKey,
        q:             keyword,
        location:      'India',
        google_domain: 'google.co.in',
        gl:            'in',
        hl:            'en',
        num:           '50',
        output:        'json',
      });

      const res = await fetch(`${this.baseUrl}?${params}`);
      if (!res.ok) {
        logger.error('ValueSERP API error', { status: res.status, keyword });
        return { position: null, url: null, title: null, isReal: false };
      }

      const data    = await res.json();
      const results = data?.organic_results ?? [];

      // Normalize domain for matching
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
        ? { position: match.position, url: match.link, title: match.title, isReal: true }
        : { position: null, url: null, title: null, isReal: true }; // not in top 50
    } catch (err) {
      logger.error('SerpService.getRank failed', { keyword, error: err.message });
      return { position: null, url: null, title: null, isReal: false };
    }
  }

  /**
   * Bulk rank check with 1.1s delay between requests to respect rate limits.
   * Returns array of { keyword, position, url, title, isReal }
   */
  async getRanks(keywords, targetDomain) {
    const results = [];
    for (const kw of keywords) {
      const rank = await this.getRank(kw, targetDomain);
      results.push({ keyword: kw, ...rank });
      // Rate limit: ~50 req/min max on free tier
      await new Promise(r => setTimeout(r, 1100));
    }
    return results;
  }
}

module.exports = new SerpService();
