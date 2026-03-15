'use strict';

const logger = require('../../config/logger');

// Tavily Search — FREE 1,000 credits/month, no credit card
// Purpose-built for AI agents and RAG. Returns cleaned content + relevance scores.
// Basic search = 1 credit, Advanced = 2 credits.
// Docs: https://docs.tavily.com
const TAVILY_BASE = 'https://api.tavily.com';

class TavilyAdapter {
  constructor() {
    this.apiKey = process.env.TAVILY_API_KEY || null;
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  /**
   * Search the web and return AI-ready results.
   * @param {string} query
   * @param {object} opts
   * @param {number} opts.maxResults - max results to return (default 5)
   * @param {'basic'|'advanced'} opts.depth - basic=1 credit, advanced=2 credits (better results)
   * @param {string[]} opts.includeDomains - only return results from these domains
   * @param {string[]} opts.excludeDomains - exclude these domains
   * @param {boolean} opts.includeAnswer - get AI-synthesized answer (default true)
   * @returns {{ answer: string, results: { url, title, content, score }[], query }}
   */
  async search(query, opts = {}) {
    if (!this.apiKey) {
      logger.warn('TavilyAdapter: TAVILY_API_KEY not set');
      return null;
    }

    const {
      maxResults      = 5,
      depth           = 'basic',
      includeDomains  = [],
      excludeDomains  = [],
      includeAnswer   = true,
    } = opts;

    try {
      const res = await fetch(`${TAVILY_BASE}/search`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          query,
          search_depth:     depth,
          max_results:      maxResults,
          include_answer:   includeAnswer,
          include_domains:  includeDomains,
          exclude_domains:  excludeDomains,
        }),
      });

      if (res.status === 429) {
        logger.warn('TavilyAdapter: rate limited (100 req/min)');
        return null;
      }

      if (!res.ok) {
        const body = await res.text();
        logger.error('TavilyAdapter: API error', { status: res.status, body: body.slice(0, 300) });
        return null;
      }

      const data = await res.json();
      logger.info('TavilyAdapter: search complete', { query, results: data.results?.length });

      return {
        query,
        answer:  data.answer ?? null,
        results: (data.results || []).map((r) => ({
          url:     r.url,
          title:   r.title,
          content: r.content,
          score:   r.score,
        })),
      };
    } catch (err) {
      logger.error('TavilyAdapter: network error', { error: err.message });
      return null;
    }
  }

  /**
   * Check if a brand/domain appears in AI-cited web sources for a query.
   * Used for GEO (Generative Engine Optimization) visibility checking.
   * @param {string} keyword - e.g. "best email marketing tool"
   * @param {string} domain  - e.g. "mailchimp.com"
   * @returns {{ cited: boolean, rank: number|null, sources: string[] }}
   */
  async checkGEOCitation(keyword, domain) {
    const result = await this.search(keyword, { maxResults: 10, depth: 'advanced', includeAnswer: true });
    if (!result) return { cited: false, rank: null, sources: [] };

    const sources = result.results.map((r) => r.url);
    const matchIndex = sources.findIndex((url) => url.includes(domain));

    return {
      cited:   matchIndex !== -1,
      rank:    matchIndex !== -1 ? matchIndex + 1 : null,
      sources: sources.slice(0, 10),
      aiAnswer: result.answer,
      aiMentionsDomain: result.answer ? result.answer.toLowerCase().includes(domain.toLowerCase()) : false,
    };
  }

  /**
   * Extract clean content from a URL (cheaper than Puppeteer for text-only pages).
   * @param {string} url
   * @returns {string|null}
   */
  async extractContent(url) {
    if (!this.apiKey) return null;

    try {
      const res = await fetch(`${TAVILY_BASE}/extract`, {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ urls: [url] }),
      });

      if (!res.ok) return null;
      const data = await res.json();
      return data?.results?.[0]?.raw_content ?? null;
    } catch {
      return null;
    }
  }
}

module.exports = new TavilyAdapter();
