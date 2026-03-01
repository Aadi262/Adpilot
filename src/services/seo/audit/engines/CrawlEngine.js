'use strict';

const { URL }           = require('url');
const axios             = require('axios');
const BaseCrawlerAdapter = require('../adapters/BaseCrawlerAdapter');
const SEO_CONFIG        = require('../../../../config/seo');
const logger            = require('../../../../config/logger');

/**
 * CrawlEngine — Breadth-First-Search multi-page web crawler.
 *
 * Responsibilities:
 *   1. BFS crawl from a seed URL, respecting maxPages / maxDepth / concurrency
 *   2. Domain-bounded: never follows links to external domains
 *   3. Deduplicates URLs before fetching (visited + queued sets)
 *   4. Post-crawl: computes inboundLinkCount + isOrphan for every page
 *   5. Post-crawl: detects broken internal links and redirect chains
 *   6. Out-of-band: fetches /robots.txt and /sitemap.xml (not in BFS queue)
 *
 * CrawlEngine is adapter-agnostic.  It depends only on BaseCrawlerAdapter's
 * interface, so PuppeteerAdapter can be swapped for PlaywrightAdapter, etc.
 *
 * Output shape (CrawlResult):
 * {
 *   baseUrl:    string,
 *   crawlStats: {
 *     pagesFound:        number,   // total distinct URLs discovered (incl. uncrawled)
 *     pagesCrawled:      number,   // pages actually fetched
 *     durationMs:        number,
 *     maxDepth:          number,   // deepest page encountered
 *     hasSitemap:        boolean,
 *     hasRobots:         boolean,
 *     robotsBlocksCrawl: boolean,
 *   },
 *   pages:         PageData[],     // all crawled pages (failed ones included)
 *   brokenLinks:   { from, to, statusCode }[],
 *   redirectChains:{ start, chain, end, hops, isLoop }[],
 * }
 */
class CrawlEngine {
  /**
   * @param {BaseCrawlerAdapter} adapter
   */
  constructor(adapter) {
    if (!(adapter instanceof BaseCrawlerAdapter)) {
      throw new TypeError('CrawlEngine requires an instance of BaseCrawlerAdapter');
    }
    this._adapter = adapter;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run a full BFS crawl from `seedUrl`.
   *
   * @param {string} seedUrl  - Absolute URL of the page to start from
   * @param {object} options
   * @param {number} options.maxPages     - Hard cap on pages crawled
   * @param {number} [options.maxDepth]   - Max BFS depth (default from config)
   * @param {number} [options.concurrency]- Parallel fetch slots (default from config)
   * @returns {Promise<CrawlResult>}
   */
  async crawl(seedUrl, options = {}) {
    const maxPages    = options.maxPages;
    const maxDepth    = options.maxDepth    ?? SEO_CONFIG.crawl.maxDepth;
    const concurrency = options.concurrency ?? SEO_CONFIG.crawl.concurrency;

    if (!maxPages || maxPages < 1) {
      throw new Error('CrawlEngine.crawl() requires options.maxPages >= 1');
    }

    // ── Normalise seed URL ───────────────────────────────────────────────────
    const baseUrl = this._normalizeUrl(seedUrl, seedUrl);
    if (!baseUrl) throw new Error(`Invalid seed URL: ${seedUrl}`);

    const parsedBase = new URL(baseUrl);
    const baseDomain = parsedBase.hostname;
    const startMs    = Date.now();

    logger.info('CrawlEngine: starting crawl', { baseUrl, maxPages, maxDepth, concurrency });

    // ── Out-of-band checks ───────────────────────────────────────────────────
    // Fetch robots.txt and sitemap.xml concurrently, before BFS begins.
    const [robotsResult, sitemapResult] = await Promise.allSettled([
      this._checkRobots(baseUrl),
      this._checkSitemap(baseUrl),
    ]);

    const robotsInfo = robotsResult.status === 'fulfilled'
      ? robotsResult.value
      : { exists: false, blocksCrawl: false, disallowedPaths: [] };

    const hasSitemap = sitemapResult.status === 'fulfilled'
      ? sitemapResult.value
      : false;

    // ── BFS state ────────────────────────────────────────────────────────────
    /** @type {Set<string>} Pages already fetched (or currently in-flight) */
    const visited = new Set();

    /** @type {Set<string>} Pages in the queue (not yet started) */
    const queued  = new Set();

    /** @type {{ url: string, depth: number }[]} */
    const queue = [{ url: baseUrl, depth: 0 }];

    /** @type {RawPageData[]} Accumulates all fetched page data */
    const pages = [];

    // Seed is considered queued
    queued.add(baseUrl);

    // ── BFS loop ─────────────────────────────────────────────────────────────
    while (queue.length > 0 && pages.length < maxPages) {
      const remaining = maxPages - pages.length;
      const batchSize = Math.min(concurrency, queue.length, remaining);
      const batch     = queue.splice(0, batchSize);

      // Mark batch members as visited before firing requests so concurrent
      // BFS iterations don't double-enqueue the same URL
      for (const { url } of batch) {
        visited.add(url);
        queued.delete(url);
      }

      const results = await Promise.allSettled(
        batch.map(({ url, depth }) =>
          this._adapter.fetchPage(url, depth, { timeout: SEO_CONFIG.crawl.timeout })
        )
      );

      for (let i = 0; i < results.length; i++) {
        const { url, depth } = batch[i];
        let pageData;

        if (results[i].status === 'fulfilled') {
          pageData = results[i].value;
        } else {
          // Adapter threw — should not happen (adapter catches internally),
          // but we handle it defensively.
          const errMsg = results[i].reason?.message ?? 'unknown adapter error';
          logger.warn('CrawlEngine: adapter threw unexpectedly', { url, error: errMsg });
          pageData = this._makeFailedPage(url, url, depth, errMsg);
        }

        pages.push(pageData);

        // ── Enqueue new internal links ───────────────────────────────────
        if (!pageData.failed && depth < maxDepth) {
          for (const rawLink of pageData.internalLinks) {
            // Normalize relative to the page's *final* URL (post-redirect)
            const normalized = this._normalizeUrl(rawLink, pageData.finalUrl || url);
            if (!normalized)                               continue;
            if (!this._isSameDomain(normalized, baseDomain)) continue;
            if (visited.has(normalized))                   continue;
            if (queued.has(normalized))                    continue;

            // Respect robots.txt disallow paths
            if (
              robotsInfo.disallowedPaths?.length &&
              this._isRobotsDisallowed(normalized, robotsInfo.disallowedPaths)
            ) continue;

            // Check we won't exceed maxPages even accounting for all queued items
            if (pages.length + queued.size + 1 > maxPages) break;

            queued.add(normalized);
            queue.push({ url: normalized, depth: depth + 1 });
          }
        }
      }

      logger.debug('CrawlEngine: BFS batch complete', {
        batchSize,
        pagesCrawled: pages.length,
        queueRemaining: queue.length,
      });
    }

    const durationMs = Date.now() - startMs;

    logger.info('CrawlEngine: crawl complete', {
      baseUrl,
      pagesCrawled: pages.length,
      pagesFound:   visited.size + queue.length,  // includes uncrawled discovered pages
      durationMs,
    });

    // ── Post-crawl computed fields ────────────────────────────────────────────
    this._computeInboundLinks(pages);

    const { brokenLinks, redirectChains } = this._detectPostCrawlIssues(pages, baseDomain);

    // maxDepth actually found (may be less than configured limit)
    const actualMaxDepth = pages.reduce((max, p) => Math.max(max, p.depth), 0);

    return {
      baseUrl,
      crawlStats: {
        pagesFound:        visited.size + queue.length,
        pagesCrawled:      pages.length,
        durationMs,
        maxDepth:          actualMaxDepth,
        hasSitemap,
        hasRobots:         robotsInfo.exists,
        robotsBlocksCrawl: robotsInfo.blocksCrawl,
      },
      pages,
      brokenLinks,
      redirectChains,
    };
  }

  // ── Post-crawl analysis ────────────────────────────────────────────────────

  /**
   * Compute inboundLinkCount and isOrphan for every page.
   *
   * Algorithm: O(total links across all pages)
   *   - Build a URL → page map (O(1) lookup)
   *   - Walk every page's internalLinks list, increment target's counter
   *   - isOrphan = depth > 0 && inboundLinkCount === 0
   *
   * Mutates the page objects in-place (avoids a second array allocation).
   *
   * @param {RawPageData[]} pages
   */
  _computeInboundLinks(pages) {
    // Initialise counters
    for (const page of pages) {
      page.inboundLinkCount = 0;
      page.isOrphan         = false;
    }

    // Build URL → page index for O(1) target lookups
    const urlIndex = new Map();
    for (const page of pages) {
      urlIndex.set(page.url, page);
      // Also index finalUrl in case redirect changed the URL
      if (page.finalUrl && page.finalUrl !== page.url) {
        urlIndex.set(page.finalUrl, page);
      }
    }

    // Count inbound links
    for (const page of pages) {
      if (page.failed) continue;
      for (const link of page.internalLinks) {
        const target = urlIndex.get(link);
        if (target) target.inboundLinkCount++;
      }
    }

    // Mark orphans
    for (const page of pages) {
      if (page.depth > 0 && page.inboundLinkCount === 0) {
        page.isOrphan = true;
      }
    }
  }

  /**
   * Detect broken internal links and redirect chains across all pages.
   *
   * Broken link  = internal link whose target page has statusCode >= 400
   * Redirect chain = page was reached via ≥1 intermediary redirect
   *
   * @param {RawPageData[]} pages
   * @param {string}        baseDomain
   * @returns {{ brokenLinks: BrokenLink[], redirectChains: RedirectChainEntry[] }}
   */
  _detectPostCrawlIssues(pages, baseDomain) {
    const urlIndex         = new Map(pages.map((p) => [p.url, p]));
    const brokenLinks      = [];
    const redirectChains   = [];
    const seenRedirectKeys = new Set();

    for (const page of pages) {
      // ── Broken links ─────────────────────────────────────────────────────
      if (!page.failed) {
        for (const link of page.internalLinks) {
          const target = urlIndex.get(link);
          if (target && target.statusCode >= 400) {
            brokenLinks.push({
              from:       page.url,
              to:         link,
              statusCode: target.statusCode,
            });
          }
        }
      }

      // ── Redirect chains ──────────────────────────────────────────────────
      if (page.redirectChain && page.redirectChain.length > 0) {
        const startUrl = page.redirectChain[0];
        const key      = `${startUrl}→${page.url}`;

        if (!seenRedirectKeys.has(key)) {
          seenRedirectKeys.add(key);

          const fullChain = [...page.redirectChain, page.url];
          const isLoop    = page.redirectChain.includes(page.url);

          redirectChains.push({
            start:  startUrl,
            chain:  fullChain,
            end:    page.url,
            hops:   page.redirectChain.length,
            isLoop,
          });
        }
      }
    }

    return { brokenLinks, redirectChains };
  }

  // ── Out-of-band resource checks ────────────────────────────────────────────

  /**
   * Fetch /robots.txt and parse it for Disallow directives.
   *
   * Returns { exists, blocksCrawl } where blocksCrawl is true only if
   * a matching user-agent block has `Disallow: /` (entire site blocked).
   *
   * @param {string} baseUrl
   * @returns {Promise<{ exists: boolean, blocksCrawl: boolean }>}
   */
  async _checkRobots(baseUrl) {
    const robotsUrl = new URL('/robots.txt', baseUrl).href;
    try {
      const response = await axios.get(robotsUrl, {
        timeout:     SEO_CONFIG.crawl.lightHttpTimeout,
        headers:     { 'User-Agent': SEO_CONFIG.crawl.userAgent },
        maxRedirects: 3,
        validateStatus: (s) => s < 500, // treat 4xx as "file missing", not error
      });

      if (response.status >= 400) return { exists: false, blocksCrawl: false, disallowedPaths: [] };

      const text = typeof response.data === 'string' ? response.data : '';
      return { exists: true, ...this._parseRobots(text) };
    } catch {
      return { exists: false, blocksCrawl: false, disallowedPaths: [] };
    }
  }

  /**
   * Parse robots.txt and return blocksCrawl + all disallowed paths that apply
   * to our user-agent or the wildcard agent.
   *
   * Handles: User-agent blocks, Disallow directives (including Disallow: /).
   * Does NOT handle: Allow overrides, wildcard patterns (e.g. /path/*), Crawl-delay.
   *
   * @param {string} text
   * @returns {{ blocksCrawl: boolean, disallowedPaths: string[] }}
   */
  _parseRobots(text) {
    let inScope         = false;
    let blocksCrawl     = false;
    const disallowedPaths = [];

    for (const rawLine of text.split('\n')) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const lower = line.toLowerCase();

      if (lower.startsWith('user-agent:')) {
        const agent = lower.slice('user-agent:'.length).trim();
        inScope = (agent === '*') || agent.includes('adpilot');
      } else if (inScope && lower.startsWith('disallow:')) {
        const path = line.slice('disallow:'.length).trim();
        if (!path) continue; // empty Disallow = allow all
        disallowedPaths.push(path);
        if (path === '/') blocksCrawl = true;
      }
    }

    return { blocksCrawl, disallowedPaths };
  }

  /**
   * Check if a URL's pathname starts with any robots.txt disallow path.
   *
   * @param {string}   url
   * @param {string[]} disallowedPaths
   * @returns {boolean}
   */
  _isRobotsDisallowed(url, disallowedPaths) {
    let pathname;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return false;
    }

    for (const disallowedPath of disallowedPaths) {
      if (disallowedPath === '/') return true; // entire site blocked
      if (pathname.startsWith(disallowedPath)) return true;
    }
    return false;
  }

  /**
   * Check if /sitemap.xml is reachable (returns 200–399).
   *
   * @param {string} baseUrl
   * @returns {Promise<boolean>}
   */
  async _checkSitemap(baseUrl) {
    const sitemapUrl = new URL('/sitemap.xml', baseUrl).href;
    try {
      const response = await axios.head(sitemapUrl, {
        timeout:      SEO_CONFIG.crawl.lightHttpTimeout,
        headers:      { 'User-Agent': SEO_CONFIG.crawl.userAgent },
        maxRedirects: 3,
        validateStatus: () => true,  // never throw on any status
      });
      return response.status >= 200 && response.status < 400;
    } catch {
      return false;
    }
  }

  // ── URL utilities ──────────────────────────────────────────────────────────

  /**
   * Resolve `href` against `base`, strip fragment, normalize trailing slash.
   * Returns null if the URL is invalid or uses a non-HTTP(S) scheme.
   *
   * @param {string} href
   * @param {string} base
   * @returns {string|null}
   */
  _normalizeUrl(href, base) {
    try {
      const u = new URL(href, base);
      if (!['http:', 'https:'].includes(u.protocol)) return null;

      u.hash = ''; // strip fragment — anchors are same-page, not new pages

      let normalized = u.href;
      // Strip trailing slash from non-root paths for consistent deduplication
      // e.g. https://example.com/about/ → https://example.com/about
      if (u.pathname.length > 1 && normalized.endsWith('/')) {
        normalized = normalized.slice(0, -1);
      }
      return normalized;
    } catch {
      return null;
    }
  }

  /**
   * Return true if `url` belongs to the same hostname as `baseDomain`.
   * Subdomains (www.example.com vs example.com) are treated as different
   * domains — intentional, since content and SEO context differ.
   *
   * @param {string} url
   * @param {string} baseDomain
   * @returns {boolean}
   */
  _isSameDomain(url, baseDomain) {
    try {
      return new URL(url).hostname === baseDomain;
    } catch {
      return false;
    }
  }

  /**
   * Build a placeholder RawPageData for a URL that could not be fetched.
   * Rules inspect these records to detect broken links.
   *
   * @param {string} url
   * @param {string} finalUrl
   * @param {number} depth
   * @param {string} failReason
   * @returns {RawPageData}
   */
  _makeFailedPage(url, finalUrl, depth, failReason) {
    return {
      url,
      finalUrl,
      depth,
      statusCode:         0,
      redirectChain:      [],
      failed:             true,
      failReason,
      loadTimeMs:         0,

      title:              null,
      titleLength:        0,
      metaDescription:    null,
      metaDescLength:     0,
      h1Count:            0,
      h1Text:             null,
      h2Count:            0,
      wordCount:          0,
      imagesMissingAlt:   0,
      totalImages:        0,
      internalLinksCount: 0,
      externalLinksCount: 0,
      internalLinks:      [],
      canonicalTag:       null,
      hasSchema:          false,
      hasOpenGraph:       false,
      hasViewport:        false,
      isHttps:            url.startsWith('https://'),
      inboundLinkCount:   0,
      isOrphan:           false,
    };
  }
}

module.exports = CrawlEngine;
