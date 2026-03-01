'use strict';

const BaseRule = require('../BaseRule');

/**
 * LazyLoadingRule — detects image-heavy pages that don't use lazy loading.
 *
 * Issues emitted:
 *   no_image_lazy_loading (low) — pages with many images but no lazy loading
 *
 * Data source:
 *   `page.totalImages`   — total <img> count
 *   `page.hasLazyImages` — true if any <img loading="lazy"> found on the page
 *
 * Threshold: only flag pages with ≥ 3 images that don't have ANY lazy loading.
 * Pages with 1-2 images probably have images above the fold and lazy loading
 * doesn't help (or may hurt) their LCP score.
 *
 * Why this matters:
 *   Lazy loading defers off-screen images, reducing initial page weight and
 *   Time to Interactive. This directly improves LCP and TTI — two Core Web
 *   Vitals. `loading="lazy"` is natively supported in all modern browsers
 *   and takes ~30 seconds to implement per image template.
 */
class LazyLoadingRule extends BaseRule {
  static get IMAGE_THRESHOLD() { return 3; }

  evaluate({ pages }) {
    const live = this._livePages(pages);

    const affected = live.filter(
      (p) => p.totalImages >= LazyLoadingRule.IMAGE_THRESHOLD && !p.hasLazyImages
    ).map((p) => p.url);

    if (!affected.length) return [];

    return [
      this._buildIssue({
        id:             'no_image_lazy_loading',
        severity:       'low',
        category:       'content',
        affectedPages:  affected,
        impactScore:    3,
        description:    `${affected.length} page(s) have ${LazyLoadingRule.IMAGE_THRESHOLD}+ images but none use native lazy loading. Loading all images immediately increases page weight and slows Time to Interactive.`,
        recommendation: 'Add loading="lazy" to all <img> tags that are not in the initial viewport (typically everything below the fold). Do NOT add it to your hero image or LCP image — those should load immediately.',
        autoFixable:    true,
      }),
    ];
  }
}

module.exports = LazyLoadingRule;
