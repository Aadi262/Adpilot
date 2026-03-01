'use strict';

const BaseRule = require('../BaseRule');

/**
 * SecurityHeadersRule — detects missing HTTP security response headers.
 *
 * Issues emitted:
 *   missing_x_frame_options      (medium) — no X-Frame-Options or CSP frame-ancestors
 *   missing_x_content_type       (low)    — no X-Content-Type-Options: nosniff
 *   missing_hsts                 (medium) — HTTPS site without Strict-Transport-Security
 *
 * Data source: `page.responseHeaders` — extracted from the HTTP response by
 * PuppeteerAdapter (lowercase header names from Puppeteer's headers() call).
 *
 * Why security headers matter for SEO:
 *   - Clickjacking (missing X-Frame-Options) can harm brand trust
 *   - HSTS speeds up HTTPS connections (reduced redirect latency)
 *   - Browsers may block pages with MIME-sniff issues, reducing indexed content
 *   - Google considers site security as part of the E-E-A-T evaluation
 */
class SecurityHeadersRule extends BaseRule {
  evaluate({ pages }) {
    const live = this._livePages(pages);

    const missingXfo   = [];
    const missingXcto  = [];
    const missingHsts  = [];

    for (const page of live) {
      const h = page.responseHeaders ?? {};

      // X-Frame-Options OR CSP with frame-ancestors covers clickjacking
      const hasXfo       = !!(h['x-frame-options']);
      const hasCspFrame  = !!(h['content-security-policy']?.includes('frame-ancestors'));
      if (!hasXfo && !hasCspFrame) missingXfo.push(page.url);

      // X-Content-Type-Options: nosniff
      if (!h['x-content-type-options']) missingXcto.push(page.url);

      // HSTS only matters on HTTPS pages
      if (page.isHttps && !h['strict-transport-security']) missingHsts.push(page.url);
    }

    const issues = [];

    if (missingXfo.length) {
      issues.push(this._buildIssue({
        id:             'missing_x_frame_options',
        severity:       'medium',
        category:       'technical',
        affectedPages:  missingXfo,
        impactScore:    6,
        description:    `${missingXfo.length} page(s) lack X-Frame-Options or a CSP frame-ancestors directive. These headers prevent clickjacking attacks that could harm user trust and brand reputation.`,
        recommendation: 'Add the response header X-Frame-Options: SAMEORIGIN, or set Content-Security-Policy: frame-ancestors \'self\' to prevent your pages from being embedded in malicious iframes.',
        autoFixable:    false,
      }));
    }

    if (missingXcto.length) {
      issues.push(this._buildIssue({
        id:             'missing_x_content_type',
        severity:       'low',
        category:       'technical',
        affectedPages:  missingXcto,
        impactScore:    3,
        description:    `${missingXcto.length} page(s) are missing the X-Content-Type-Options: nosniff header. Without it, browsers may MIME-sniff responses and misinterpret content types.`,
        recommendation: 'Add X-Content-Type-Options: nosniff to all HTTP responses. This is a one-line server config change (nginx, Apache, or CDN rules).',
        autoFixable:    false,
      }));
    }

    if (missingHsts.length) {
      issues.push(this._buildIssue({
        id:             'missing_hsts',
        severity:       'medium',
        category:       'technical',
        affectedPages:  missingHsts,
        impactScore:    6,
        description:    `${missingHsts.length} HTTPS page(s) are missing the Strict-Transport-Security (HSTS) header. HSTS tells browsers to always use HTTPS, eliminating redirect overhead and man-in-the-middle risk.`,
        recommendation: 'Add Strict-Transport-Security: max-age=31536000; includeSubDomains to all HTTPS responses. Start with a short max-age (86400) during rollout and increase after validation.',
        autoFixable:    false,
      }));
    }

    return issues;
  }
}

module.exports = SecurityHeadersRule;
