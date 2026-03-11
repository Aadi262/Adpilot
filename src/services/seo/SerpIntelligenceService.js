'use strict';

const axios = require('axios');
const cheerio = require('cheerio');
const logger = require('../../config/logger');

class SerpIntelligenceService {
  constructor() {
    this.apiKey = process.env.VALUESERP_API_KEY || null;
    this.baseUrl = 'https://api.valueserp.com/search';
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  async search(query, { num = 10, location = 'India', gl = 'in', hl = 'en' } = {}) {
    if (!this.apiKey) return null;

    try {
      const params = new URLSearchParams({
        api_key: this.apiKey,
        q: query,
        location,
        google_domain: gl === 'in' ? 'google.co.in' : 'google.com',
        gl,
        hl,
        num: String(num),
        output: 'json',
      });

      const res = await fetch(`${this.baseUrl}?${params}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        logger.warn('SerpIntelligenceService.search failed', { query, status: res.status });
        return null;
      }
      return res.json();
    } catch (err) {
      logger.warn('SerpIntelligenceService.search error', { query, message: err.message });
      return null;
    }
  }

  async getKeywordSnapshot(keyword) {
    const data = await this.search(keyword, { num: 10 });
    if (!data) return null;

    const organicResults = Array.isArray(data.organic_results) ? data.organic_results : [];
    const relatedQuestions = Array.isArray(data.related_questions) ? data.related_questions : [];
    const relatedSearches = Array.isArray(data.related_searches) ? data.related_searches : [];
    const paidResults = Array.isArray(data.ads) ? data.ads : [];

    return {
      organicResults: organicResults.slice(0, 10).map((r) => ({
        position: r.position,
        title: r.title,
        link: r.link,
        domain: r.domain,
        snippet: r.snippet,
      })),
      relatedQuestions: relatedQuestions.slice(0, 8).map((q) => q.question || q),
      relatedSearches: relatedSearches.slice(0, 10).map((s) => s.query || s),
      paidResults: paidResults.slice(0, 5).map((ad) => ({
        title: ad.title,
        link: ad.link,
        domain: ad.domain,
      })),
      totalResults: Number(data.search_information?.total_results) || null,
      serpFeatures: this._extractSerpFeatures(data),
    };
  }

  async getTopResultDetails(keyword, limit = 5) {
    const snapshot = await this.getKeywordSnapshot(keyword);
    const topResults = (snapshot?.organicResults || []).slice(0, limit);

    const details = await Promise.all(topResults.map((result) => this._fetchPageDetails(result)));
    return {
      snapshot,
      topResults: details.filter(Boolean),
    };
  }

  async enrichKeywordList(keywords = [], domain = null) {
    const seen = new Set();
    const output = [];

    for (const rawKeyword of keywords) {
      const keyword = typeof rawKeyword === 'string'
        ? rawKeyword
        : rawKeyword?.keyword || rawKeyword?.word || '';
      const clean = keyword.trim().toLowerCase();
      if (!clean || seen.has(clean)) continue;
      seen.add(clean);

      const snapshot = await this.getKeywordSnapshot(clean);
      const rankingMatch = domain
        ? (snapshot?.organicResults || []).find((result) => this._matchesDomain(result.domain || result.link, domain))
        : null;
      output.push({
        keyword: clean,
        searchVolume: null,
        cpc: null,
        competition: snapshot?.paidResults?.length ?? null,
        position: rankingMatch?.position ?? null,
        serpFeatures: snapshot?.serpFeatures ?? [],
        relatedQuestions: snapshot?.relatedQuestions ?? [],
        relatedSearches: snapshot?.relatedSearches ?? [],
        totalResults: snapshot?.totalResults ?? null,
      });
    }

    return output;
  }

  async _fetchPageDetails(result) {
    if (!result?.link) return null;

    try {
      const res = await axios.get(result.link, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdPilot/1.0)' },
        maxRedirects: 5,
      });

      const $ = cheerio.load(res.data);
      const headings = $('h1, h2, h3')
        .toArray()
        .map((el) => $(el).text().trim())
        .filter(Boolean)
        .slice(0, 15);

      const text = $('body').text().replace(/\s+/g, ' ').trim();
      const wordCount = text ? text.split(' ').filter(Boolean).length : 0;

      return {
        ...result,
        headings,
        wordCount,
      };
    } catch (err) {
      logger.debug('SerpIntelligenceService._fetchPageDetails failed', {
        url: result.link,
        message: err.message,
      });
      return {
        ...result,
        headings: [],
        wordCount: 0,
      };
    }
  }

  _extractSerpFeatures(data) {
    const features = new Set();
    if (data.answer_box) features.add('featured_snippet');
    if (Array.isArray(data.related_questions) && data.related_questions.length) features.add('people_also_ask');
    if (Array.isArray(data.inline_videos) && data.inline_videos.length) features.add('video');
    if (Array.isArray(data.inline_images) && data.inline_images.length) features.add('images');
    if (Array.isArray(data.local_results) && data.local_results.length) features.add('local_pack');
    if (Array.isArray(data.shopping_results) && data.shopping_results.length) features.add('shopping');
    return [...features];
  }

  _matchesDomain(candidate, domain) {
    if (!candidate || !domain) return false;

    try {
      const target = String(domain).replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
      const host = candidate.includes('://')
        ? new URL(candidate).hostname.toLowerCase().replace(/^www\./, '')
        : String(candidate).toLowerCase().replace(/^www\./, '');
      return host === target || host.endsWith(`.${target}`);
    } catch {
      return false;
    }
  }
}

module.exports = new SerpIntelligenceService();
