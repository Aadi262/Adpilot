'use strict';

/**
 * Rule Registry — single source of truth for all active SEO rules.
 *
 * Rules are listed explicitly (never auto-discovered via filesystem scanning).
 * This makes it safe for production bundlers, tree-shakers, and Docker
 * environments where the working directory structure isn't predictable.
 *
 * To add a new rule:
 *   1. Create the rule file in the appropriate category subfolder
 *   2. Add a `new RuleName()` line here in the correct category block
 *
 * To disable a rule without deleting it:
 *   Comment out its line.  It will not be evaluated.
 *
 * Evaluation order within a category does not affect scoring — TechnicalAnalyzer
 * collects all Issue[] results and the ScoringEngine applies weights separately.
 * However, listing critical rules first makes logs easier to read.
 */

// ── Technical ─────────────────────────────────────────────────────────────────
const TitleRule            = require('./technical/TitleRule');
const MetaDescriptionRule  = require('./technical/MetaDescriptionRule');
const HeadingRule          = require('./technical/HeadingRule');
const HeadingHierarchyRule = require('./technical/HeadingHierarchyRule');
const CanonicalRule        = require('./technical/CanonicalRule');
const HttpsRule            = require('./technical/HttpsRule');
const ViewportRule         = require('./technical/ViewportRule');
const SecurityHeadersRule  = require('./technical/SecurityHeadersRule');
const OpenGraphRule        = require('./technical/OpenGraphRule');
const SchemaMarkupRule     = require('./technical/SchemaMarkupRule');
const SitemapRule          = require('./technical/SitemapRule');
const RobotsTxtRule        = require('./technical/RobotsTxtRule');
const BrokenLinksRule      = require('./technical/BrokenLinksRule');
const RedirectChainRule    = require('./technical/RedirectChainRule');

// ── Content ───────────────────────────────────────────────────────────────────
const WordCountRule         = require('./content/WordCountRule');
const ImageAltRule          = require('./content/ImageAltRule');
const ImageDimensionsRule   = require('./content/ImageDimensionsRule');
const LazyLoadingRule       = require('./content/LazyLoadingRule');
const DuplicateTitleRule    = require('./content/DuplicateTitleRule');
const DuplicateMetaRule     = require('./content/DuplicateMetaRule');

// ── Structure ─────────────────────────────────────────────────────────────────
const OrphanPageRule        = require('./structure/OrphanPageRule');
const PageDepthRule         = require('./structure/PageDepthRule');
const InternalLinkingRule   = require('./structure/InternalLinkingRule');

/**
 * @type {BaseRule[]}
 *
 * Each entry is a constructed rule instance (not a class).  Instances are
 * created once at module load time and reused across all audit runs — rules
 * are stateless so this is safe.
 *
 * Total: 23 rules (16 original + 7 added in Phase 2)
 */
const rules = [
  // ── Technical (critical/high first for log readability) ─────────────────
  new TitleRule(),            // missing_title | title_too_short | title_too_long
  new MetaDescriptionRule(),  // missing_meta_description | meta_*_too_short/long
  new HeadingRule(),          // missing_h1 | multiple_h1
  new HeadingHierarchyRule(), // heading_hierarchy_skip
  new CanonicalRule(),        // missing_canonical
  new HttpsRule(),            // https_not_enforced
  new ViewportRule(),         // missing_viewport
  new SecurityHeadersRule(),  // missing_x_frame_options | missing_x_content_type | missing_hsts
  new OpenGraphRule(),        // missing_open_graph
  new SchemaMarkupRule(),     // missing_schema_markup
  new SitemapRule(),          // no_sitemap
  new RobotsTxtRule(),        // no_robots_txt | robots_blocks_crawl
  new BrokenLinksRule(),      // broken_internal_links
  new RedirectChainRule(),    // redirect_chain | redirect_loop

  // ── Content ─────────────────────────────────────────────────────────────
  new WordCountRule(),         // thin_content
  new ImageAltRule(),          // images_missing_alt
  new ImageDimensionsRule(),   // images_missing_dimensions
  new LazyLoadingRule(),       // no_image_lazy_loading
  new DuplicateTitleRule(),    // duplicate_title
  new DuplicateMetaRule(),     // duplicate_meta_description

  // ── Structure ───────────────────────────────────────────────────────────
  new OrphanPageRule(),        // orphan_page
  new PageDepthRule(),         // excessive_depth
  new InternalLinkingRule(),   // poor_internal_linking
];

module.exports = rules;
