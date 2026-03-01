'use strict';

const BaseRule = require('../BaseRule');

/**
 * OpenGraphRule — detects pages without Open Graph meta tags.
 *
 * Issues emitted:
 *   missing_open_graph (low) — no og:title, og:description, og:image found
 *
 * Data source: `page.hasOpenGraph` — `$('meta[property^="og:"]').length > 0`,
 * captured by PuppeteerAdapter.
 *
 * Why this matters for SEO:
 *   Open Graph tags control how URLs appear when shared on social platforms
 *   (Facebook, LinkedIn, Twitter, Slack, Discord). Pages without OG tags
 *   display as plain links, reducing click-through from social traffic.
 *   Social signals and referral traffic indirectly influence rankings.
 *
 * Only flags pages at depth <= 1 (homepage + top-level pages) since deep
 * pages are rarely shared on social media and adding OG tags to all 1000+
 *  pages would be an unreasonable recommendation.
 */
class OpenGraphRule extends BaseRule {
  evaluate({ pages }) {
    const live = this._livePages(pages);

    // Only check shallow pages — social sharing targets homepage + key sections
    const shallow      = live.filter((p) => p.depth <= 1);
    const missingOg    = shallow.filter((p) => !p.hasOpenGraph).map((p) => p.url);

    if (!missingOg.length) return [];

    return [
      this._buildIssue({
        id:             'missing_open_graph',
        severity:       'low',
        category:       'technical',
        affectedPages:  missingOg,
        impactScore:    3,
        description:    `${missingOg.length} key page(s) (depth ≤ 1) are missing Open Graph meta tags. Without OG tags, social media platforms generate low-quality link previews, reducing click-through from shared content.`,
        recommendation: 'Add og:title, og:description, og:image, and og:url meta tags to all publicly shared pages. Use a 1200×630px image for the og:image. Most CMS platforms have SEO plugins that automate this.',
        autoFixable:    false,
      }),
    ];
  }
}

module.exports = OpenGraphRule;
