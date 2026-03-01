'use strict';

const BaseRule = require('../BaseRule');

/**
 * ImageDimensionsRule — detects images without explicit width/height attributes.
 *
 * Issues emitted:
 *   images_missing_dimensions (low)
 *
 * Data source: `page.imagesMissingDimensions` — count of <img> elements that
 * have neither a width nor a height attribute, captured by PuppeteerAdapter.
 *
 * Why this matters for SEO:
 *   Missing width/height attributes cause layout shifts as images load —
 *   contributing to a high Cumulative Layout Shift (CLS) score, which is a
 *   Core Web Vital and a direct Google ranking signal. Browsers need the
 *   dimensions to reserve the correct space before the image loads.
 */
class ImageDimensionsRule extends BaseRule {
  evaluate({ pages }) {
    const live = this._livePages(pages);

    const affected  = [];
    let   totalMissing = 0;

    for (const page of live) {
      const missing = page.imagesMissingDimensions ?? 0;
      if (missing > 0) {
        affected.push(page.url);
        totalMissing += missing;
      }
    }

    if (!affected.length) return [];

    return [
      this._buildIssue({
        id:             'images_missing_dimensions',
        severity:       'low',
        category:       'content',
        affectedPages:  affected,
        impactScore:    3,
        description:    `${totalMissing} image(s) across ${affected.length} page(s) are missing explicit width and height attributes. This causes layout shifts during page load, increasing Cumulative Layout Shift (CLS) — a Core Web Vital Google uses as a ranking signal.`,
        recommendation: 'Add explicit width and height attributes to every <img> tag that matches the image\'s natural dimensions. If using CSS for responsive sizing, set width/height to the intrinsic dimensions and use CSS to constrain display size.',
        autoFixable:    true,
      }),
    ];
  }
}

module.exports = ImageDimensionsRule;
