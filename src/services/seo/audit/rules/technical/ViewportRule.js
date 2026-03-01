'use strict';

const BaseRule = require('../BaseRule');

/**
 * ViewportRule — detects pages missing a viewport meta tag.
 *
 * Issues emitted:
 *   missing_viewport (high) — <meta name="viewport"> absent
 *
 * A missing viewport tag prevents mobile browsers from scaling the page
 * correctly, resulting in a zoomed-out desktop view on phones.
 * Google uses mobile-first indexing, so mobile-unfriendly pages are
 * ranked lower than their mobile-optimised equivalents.
 *
 * Detection: `hasViewport` flag captured by PuppeteerAdapter via
 * `$('meta[name="viewport"]').length > 0`.
 */
class ViewportRule extends BaseRule {
  evaluate({ pages }) {
    const live    = this._livePages(pages);
    const missing = live.filter((p) => !p.hasViewport).map((p) => p.url);

    if (!missing.length) return [];

    return [
      this._buildIssue({
        id:             'missing_viewport',
        severity:       'high',
        category:       'technical',
        affectedPages:  missing,
        impactScore:    18,
        description:    `${missing.length} page(s) are missing a viewport meta tag. Google uses mobile-first indexing — pages without a viewport meta tag are treated as non-mobile-friendly and ranked lower.`,
        recommendation: 'Add <meta name="viewport" content="width=device-width, initial-scale=1"> to the <head> of every page. Use responsive CSS to ensure content adapts to all screen sizes.',
        autoFixable:    true,
      }),
    ];
  }
}

module.exports = ViewportRule;
