'use strict';

const https   = require('https');
const cheerio = require('cheerio');
const logger  = require('../../config/logger');

/**
 * GoogleScraper — Free SERP rank checking with no API key.
 *
 * Uses DuckDuckGo HTML endpoint (more scraper-friendly than Google).
 * Checks top 30 results for domain presence.
 *
 * Limitations:
 * - Not as precise as official APIs (DuckDuckGo != Google ranking)
 * - Can be rate-limited on very high volume (>100 req/hour)
 * - Best for development & low-volume production use
 *
 * No API key required. No sign-up required. Completely free.
 */
class GoogleScraper {
  async search(keyword, { limit = 10 } = {}) {
    try {
      const html = await this._fetchDDG(keyword);
      if (!html) return { results: [], isReal: false, source: 'ddg' };

      return {
        results: this._parseResults(html).slice(0, limit),
        isReal: true,
        source: 'ddg',
      };
    } catch (err) {
      logger.warn('GoogleScraper.search failed', { keyword, error: err.message });
      return { results: [], isReal: false, source: 'ddg' };
    }
  }

  /**
   * Get the rank of a domain for a given keyword.
   * Searches DuckDuckGo HTML and finds the first result matching the domain.
   *
   * @param {string} keyword
   * @param {string} targetDomain  e.g. 'adpilot.io' or 'mysite.com'
   * @returns {{ position: number|null, url: string|null, title: string|null, isReal: boolean, source: string }}
   */
  async getRank(keyword, targetDomain) {
    try {
      const { results, isReal } = await this.search(keyword, { limit: 30 });
      if (!isReal) return { position: null, url: null, title: null, isReal: false, source: 'ddg' };
      const clean   = this._normalizeDomain(targetDomain);

      const match = results.find(r => this._normalizeDomain(r.url).includes(clean));

      return match
        ? { position: match.position, url: match.url, title: match.title, isReal: true,  source: 'ddg' }
        : { position: null,           url: null,       title: null,        isReal: true,  source: 'ddg' };

    } catch (err) {
      logger.warn('GoogleScraper.getRank failed', { keyword, error: err.message });
      return { position: null, url: null, title: null, isReal: false, source: 'ddg' };
    }
  }

  /**
   * Fetch DuckDuckGo HTML search results page.
   * Uses the lite HTML endpoint which is stable and scraper-friendly.
   */
  _fetchDDG(keyword) {
    return new Promise((resolve) => {
      const encodedQ = encodeURIComponent(keyword);
      const path     = `/html/?q=${encodedQ}&kl=in-en`;  // India/English region

      const options = {
        hostname: 'html.duckduckgo.com',
        path,
        method:   'GET',
        headers:  {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept':     'text/html,application/xhtml+xml',
          'Accept-Language': 'en-US,en;q=0.9',
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        if (res.statusCode !== 200) { resolve(null); return; }

        let body = '';
        res.on('data', chunk => { body += chunk; });
        res.on('end', () => resolve(body));
      });

      req.on('error', () => resolve(null));
      req.on('timeout', () => { req.destroy(); resolve(null); });
      req.end();
    });
  }

  /**
   * Parse DuckDuckGo HTML results into structured array.
   */
  _parseResults(html) {
    const $       = cheerio.load(html);
    const results = [];
    let position  = 1;

    $('a.result__a').each((_, el) => {
      const href  = $(el).attr('href') || '';
      const title = $(el).text().trim();
      const snippet = $(el)
        .closest('.result')
        .find('.result__snippet')
        .first()
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      if (href && !href.startsWith('//duckduckgo') && !href.includes('duckduckgo.com')) {
        results.push({ position, url: href, title, snippet });
        position++;
      }
    });

    if (results.length === 0) {
      $('span.result__url').each((i, el) => {
        const displayUrl = $(el).text().trim();
        if (displayUrl) {
          const snippet = $(el)
            .closest('.result')
            .find('.result__snippet')
            .first()
            .text()
            .replace(/\s+/g, ' ')
            .trim();
          results.push({ position: i + 1, url: displayUrl, title: displayUrl, snippet });
        }
      });
    }

    return results.slice(0, 30); // top 30 results
  }

  _normalizeDomain(urlOrDomain) {
    return (urlOrDomain || '')
      .toLowerCase()
      .replace(/^https?:\/\//,  '')
      .replace(/^www\./,        '')
      .split('/')[0]
      .split('?')[0];
  }
}

module.exports = new GoogleScraper();
