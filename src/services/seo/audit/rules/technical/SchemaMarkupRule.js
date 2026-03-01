'use strict';

const BaseRule = require('../BaseRule');

/**
 * SchemaMarkupRule — detects pages without structured data (schema.org).
 *
 * Issues emitted:
 *   missing_schema_markup (low) — no JSON-LD or microdata found on any page
 *
 * Data source: `page.hasSchema` — `$('script[type="application/ld+json"]').length > 0`,
 * captured by PuppeteerAdapter.
 *
 * Why this matters for SEO:
 *   Structured data enables rich results in Google SERPs — star ratings,
 *   breadcrumbs, FAQs, product prices, event dates, etc. These increase
 *   visual space and CTR significantly. Pages with valid schema.org markup
 *   are also better understood by Google's Knowledge Graph.
 *
 * Approach: if NO pages on the site use schema markup, emit a site-level issue.
 * If some pages already have it, we don't flag the missing ones individually
 * (that's covered by content audits, not a blanket SEO issue).
 */
class SchemaMarkupRule extends BaseRule {
  evaluate({ pages }) {
    const live     = this._livePages(pages);
    if (live.length === 0) return [];

    const hasAnySchema = live.some((p) => p.hasSchema);
    if (hasAnySchema) return [];

    // No schema found anywhere on the site — flag the homepage as representative
    const homepage = live.find((p) => p.depth === 0) ?? live[0];

    return [
      this._buildIssue({
        id:             'missing_schema_markup',
        severity:       'low',
        category:       'technical',
        affectedPages:  [homepage.url],
        impactScore:    3,
        description:    'No pages on this site have structured data (schema.org / JSON-LD). Structured data enables rich results in Google SERPs (star ratings, FAQs, breadcrumbs) which improve visibility and click-through rates.',
        recommendation: 'Add JSON-LD structured data to key pages. Start with Organization/LocalBusiness on the homepage, BreadcrumbList on inner pages, and Article on blog posts. Use Google\'s Rich Results Test to validate.',
        autoFixable:    false,
      }),
    ];
  }
}

module.exports = SchemaMarkupRule;
