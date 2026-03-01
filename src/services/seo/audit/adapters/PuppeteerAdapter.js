'use strict';

const puppeteer         = require('puppeteer');
const cheerio           = require('cheerio');
const { URL }           = require('url');
const BaseCrawlerAdapter = require('./BaseCrawlerAdapter');
const SEO_CONFIG        = require('../../../../config/seo');
const logger            = require('../../../../config/logger');

/**
 * PuppeteerAdapter — default crawler implementation.
 *
 * Design decisions:
 *
 * 1. Single browser, tab-per-page: one `puppeteer.launch()` per audit run.
 *    Tabs are opened and closed per page.  This is cheaper than launching a
 *    new browser per page, but isolated enough that one page's JS can't
 *    affect another.
 *
 * 2. Lazy browser init: the browser is not created in the constructor so that
 *    unit tests can import the class without a real Chrome binary present.
 *    `_getBrowser()` is called on first `fetchPage()` invocation.
 *
 * 3. Resource blocking: image/font/stylesheet/media requests are aborted.
 *    This cuts average page load from ~3 s to ~0.4 s.  Scripts are NOT
 *    blocked because SPAs need JS execution to render navigation links.
 *
 * 4. Cheerio on rendered HTML: after `page.content()` returns the fully
 *    rendered HTML string, Cheerio does all DOM querying in Node-land.
 *    This is faster and more testable than using `page.evaluate()` for every
 *    selector call.
 *
 * 5. Link resolution uses `finalUrl` (post-redirect), not the originally
 *    requested URL.  Relative hrefs on a redirected page resolve correctly
 *    against wherever the browser actually landed.
 */
class PuppeteerAdapter extends BaseCrawlerAdapter {
  constructor() {
    super();
    /** @type {import('puppeteer').Browser|null} */
    this._browser = null;
    /** True only while close() is executing — suppresses the spurious disconnect warn */
    this._intentionalClose = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * @param {string} url
   * @param {number} depth
   * @param {{ timeout?: number }} options
   * @returns {Promise<RawPageData>}
   */
  async fetchPage(url, depth, options = {}) {
    const timeout = options.timeout || SEO_CONFIG.crawl.timeout;
    const browser = await this._getBrowser();
    const page    = await browser.newPage();
    const startMs = Date.now();

    try {
      // ── Resource interception ────────────────────────────────────────────
      await page.setRequestInterception(true);

      page.on('request', (req) => {
        if (SEO_CONFIG.crawl.blockedResourceTypes.includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.setUserAgent(SEO_CONFIG.crawl.userAgent);

      // ── Navigation ───────────────────────────────────────────────────────
      let finalResponse;
      try {
        finalResponse = await page.goto(url, {
          waitUntil: 'domcontentloaded',
          timeout,
        });
      } catch (navErr) {
        // Timeout, DNS failure, connection refused, etc.
        logger.debug('PuppeteerAdapter: navigation error', { url, error: navErr.message });
        return this._buildFailedPage(url, url, depth, navErr.message, Date.now() - startMs);
      }

      const loadTimeMs  = Date.now() - startMs;
      const statusCode  = finalResponse ? finalResponse.status() : 0;
      const finalUrl    = page.url(); // URL after all redirects

      // Collect redirect chain (URLs that issued 3xx before landing)
      const redirectChain = finalResponse
        ? finalResponse.request().redirectChain().map((r) => r.url())
        : [];

      // ── Response headers (for security-header rules) ─────────────────────
      // Extract only the security-relevant subset — storing all headers would
      // bloat the page objects for large sites.
      const allHeaders = finalResponse ? finalResponse.headers() : {};
      const responseHeaders = {
        'x-frame-options':          allHeaders['x-frame-options']          ?? null,
        'x-content-type-options':   allHeaders['x-content-type-options']   ?? null,
        'strict-transport-security':allHeaders['strict-transport-security'] ?? null,
        'content-security-policy':  allHeaders['content-security-policy']  ?? null,
      };

      // ── Non-2xx pages: record as failed, still extract what we can ───────
      if (statusCode >= 400) {
        return this._buildFailedPage(url, finalUrl, depth, `HTTP ${statusCode}`, loadTimeMs, {
          statusCode,
          redirectChain,
          responseHeaders,
        });
      }

      // ── Parse rendered HTML ───────────────────────────────────────────────
      const html = await page.content();
      const $    = cheerio.load(html);

      // Base for resolving relative links is the *final* URL (post-redirect)
      const parsedFinal = new URL(finalUrl);
      const baseHost    = parsedFinal.hostname;

      // ── Link extraction ──────────────────────────────────────────────────
      const internalLinks  = [];
      const externalLinks  = [];
      const seenInternal   = new Set();

      $('a[href]').each((_, el) => {
        const raw = $(el).attr('href');
        if (!raw) return;

        const href = raw.trim();

        // Skip non-navigable schemes
        if (
          !href ||
          href.startsWith('#') ||
          href.startsWith('mailto:') ||
          href.startsWith('tel:') ||
          href.startsWith('javascript:') ||
          href.startsWith('data:')
        ) return;

        let resolved;
        try {
          resolved = new URL(href, finalUrl);
          resolved.hash = ''; // strip fragment — same page with different anchor
        } catch {
          return; // malformed href
        }

        // Only http(s) — skip ftp, file, etc.
        if (!['http:', 'https:'].includes(resolved.protocol)) return;

        // Normalise trailing slash from non-root paths for deduplication
        let normalized = resolved.href;
        if (resolved.pathname.length > 1 && normalized.endsWith('/')) {
          normalized = normalized.slice(0, -1);
        }

        if (resolved.hostname === baseHost) {
          if (!seenInternal.has(normalized)) {
            seenInternal.add(normalized);
            internalLinks.push(normalized);
          }
        } else {
          externalLinks.push(normalized);
        }
      });

      // ── Title ────────────────────────────────────────────────────────────
      const title    = $('title').first().text().trim() || null;

      // ── Meta description ─────────────────────────────────────────────────
      const metaDesc = $('meta[name="description"]').attr('content')?.trim() || null;

      // ── Headings ─────────────────────────────────────────────────────────
      const $h1s   = $('h1');
      const h1Text = $h1s.first().text().trim() || null;

      // Heading structure: ordered list of tag names for hierarchy checks.
      // Capped at 50 to bound memory on pages with many headings.
      const headingStructure = [];
      $('h1,h2,h3,h4,h5,h6').slice(0, 50).each((_, el) => {
        headingStructure.push(el.tagName.toLowerCase());
      });

      // ── Canonical ────────────────────────────────────────────────────────
      const canonicalTag = $('link[rel="canonical"]').attr('href')?.trim() || null;

      // ── Image audit ──────────────────────────────────────────────────────
      const $allImages      = $('img');
      const $missingAlt     = $('img:not([alt]), img[alt=""]');

      // Images missing explicit width AND height (causes CLS)
      let imagesMissingDimensions = 0;
      let hasLazyImages = false;
      $allImages.each((_, el) => {
        const $el = $(el);
        if (!$el.attr('width') && !$el.attr('height')) imagesMissingDimensions++;
        if ($el.attr('loading') === 'lazy') hasLazyImages = true;
      });

      // ── Word count ───────────────────────────────────────────────────────
      // Remove noise elements AFTER image/heading extraction
      $('script, style, noscript, nav, footer, header').remove();
      const bodyText  = $('body').text().replace(/\s+/g, ' ').trim();
      const wordCount = bodyText ? bodyText.split(/\s+/).filter(Boolean).length : 0;

      return {
        url,
        finalUrl,
        depth,
        statusCode,
        redirectChain,
        failed:    false,
        failReason: null,
        loadTimeMs,

        title,
        titleLength:        title       ? title.length       : 0,
        metaDescription:    metaDesc,
        metaDescLength:     metaDesc    ? metaDesc.length     : 0,
        h1Count:            $h1s.length,
        h1Text,
        h2Count:            $('h2').length,
        headingStructure,
        wordCount,
        imagesMissingAlt:          $missingAlt.length,
        imagesMissingDimensions,
        totalImages:               $allImages.length,
        hasLazyImages,

        internalLinksCount: internalLinks.length,
        externalLinksCount: externalLinks.length,
        internalLinks,      // CrawlEngine uses this for BFS expansion

        canonicalTag,
        responseHeaders,
        hasSchema:     $('script[type="application/ld+json"]').length > 0,
        hasOpenGraph:  $('meta[property^="og:"]').length > 0,
        hasViewport:   $('meta[name="viewport"]').length > 0,
        isHttps:       parsedFinal.protocol === 'https:',
      };

    } finally {
      // Always close the tab — never leak pages even on error
      await page.close().catch(() => {});
    }
  }

  /**
   * Close the browser.  Idempotent — safe to call multiple times.
   */
  async close() {
    if (this._browser) {
      this._intentionalClose = true;
      await this._browser.close().catch(() => {});
      this._browser = null;
      this._intentionalClose = false;
      logger.debug('PuppeteerAdapter: browser closed');
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /**
   * Lazily initialise the browser on first use.
   * Args are tuned for Docker / container environments.
   */
  async _getBrowser() {
    if (!this._browser) {
      this._browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',  // avoid /dev/shm OOM in containers
          '--disable-gpu',
          '--no-first-run',
          '--no-zygote',
          '--disable-extensions',
          '--disable-background-networking',
          '--disable-default-apps',
          '--mute-audio',
        ],
      });

      logger.debug('PuppeteerAdapter: browser launched');

      // If the browser process exits unexpectedly, null out so next call
      // relaunches rather than using a dead handle.
      // Guard with _intentionalClose so normal close() doesn't log a spurious warning.
      this._browser.on('disconnected', () => {
        if (!this._intentionalClose) {
          logger.warn('PuppeteerAdapter: browser disconnected unexpectedly');
        }
        this._browser = null;
      });
    }
    return this._browser;
  }

  /**
   * Construct a RawPageData for a page that could not be fetched.
   * CrawlEngine relies on failed pages being in the `pages` array so rules
   * can detect broken links (they look up target pages by URL).
   *
   * @param {string}  requestedUrl
   * @param {string}  finalUrl
   * @param {number}  depth
   * @param {string}  failReason
   * @param {number}  loadTimeMs
   * @param {object}  [overrides]   - e.g. { statusCode, redirectChain }
   */
  _buildFailedPage(requestedUrl, finalUrl, depth, failReason, loadTimeMs, overrides = {}) {
    return {
      url:                requestedUrl,
      finalUrl:           finalUrl || requestedUrl,
      depth,
      statusCode:         overrides.statusCode    ?? 0,
      redirectChain:      overrides.redirectChain ?? [],
      failed:             true,
      failReason,
      loadTimeMs,

      title:                    null,
      titleLength:              0,
      metaDescription:          null,
      metaDescLength:           0,
      h1Count:                  0,
      h1Text:                   null,
      h2Count:                  0,
      headingStructure:         [],
      wordCount:                0,
      imagesMissingAlt:         0,
      imagesMissingDimensions:  0,
      totalImages:              0,
      hasLazyImages:            false,
      internalLinksCount:       0,
      externalLinksCount:       0,
      internalLinks:            [],
      canonicalTag:             null,
      responseHeaders:          overrides.responseHeaders ?? {},
      hasSchema:                false,
      hasOpenGraph:             false,
      hasViewport:              false,
      isHttps:                  requestedUrl.startsWith('https://'),

      // CrawlEngine fills these in the post-crawl pass
      inboundLinkCount:   0,
      isOrphan:           false,
    };
  }
}

module.exports = PuppeteerAdapter;
