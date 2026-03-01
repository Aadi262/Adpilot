'use strict';

const BaseRule = require('../BaseRule');

/**
 * HeadingHierarchyRule — detects heading-level gaps in the page's heading structure.
 *
 * Issues emitted:
 *   heading_hierarchy_skip (medium) — a heading level is skipped (e.g. H1 → H3)
 *
 * Data source: `page.headingStructure` — array of heading tag names in DOM order
 * (e.g. ['h1', 'h2', 'h3', 'h2']), captured by PuppeteerAdapter.
 *
 * Algorithm: for every consecutive pair (tag[i], tag[i+1]) in the heading list,
 * if the level INCREASES by more than 1 (e.g. h1→h3, h2→h4), it is a skip.
 * Decreasing levels (h3→h1) are fine — they represent a new section.
 *
 * Why this matters for SEO:
 *   Heading hierarchy signals content structure to Googlebot. Skipping heading
 *   levels makes the document outline ambiguous. It also breaks accessibility,
 *   which is an indirect ranking factor via user experience signals.
 */
class HeadingHierarchyRule extends BaseRule {
  evaluate({ pages }) {
    const live     = this._livePages(pages);
    const affected = [];

    for (const page of live) {
      const structure = page.headingStructure;
      if (!Array.isArray(structure) || structure.length < 2) continue;

      let hasSkip = false;
      for (let i = 0; i < structure.length - 1; i++) {
        const currentLevel = parseInt(structure[i].slice(1), 10);
        const nextLevel    = parseInt(structure[i + 1].slice(1), 10);

        // Only flag level INCREASES > 1 (skips), not decreases
        if (nextLevel > currentLevel + 1) {
          hasSkip = true;
          break;
        }
      }

      if (hasSkip) affected.push(page.url);
    }

    if (!affected.length) return [];

    return [
      this._buildIssue({
        id:             'heading_hierarchy_skip',
        severity:       'medium',
        category:       'technical',
        affectedPages:  affected,
        impactScore:    5,
        description:    `${affected.length} page(s) have heading level gaps (e.g. H1 directly followed by H3). This breaks the semantic document outline that search engines use to understand content hierarchy.`,
        recommendation: 'Ensure headings increase by only one level at a time: H1 → H2 → H3. Inspect each page\'s heading structure and insert intermediate heading levels where levels are skipped.',
        autoFixable:    false,
      }),
    ];
  }
}

module.exports = HeadingHierarchyRule;
