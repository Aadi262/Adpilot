'use strict';

const axios   = require('axios');
const cheerio = require('cheerio');
const prisma  = require('../../config/prisma');
const logger  = require('../../config/logger');
const AppError = require('../../common/AppError');

const TITLE_MIN = 50;
const TITLE_MAX = 60;
const META_DESC_MIN = 120;
const META_DESC_MAX = 160;

class SeoAuditService {
  /**
   * Fetch and audit a URL for technical SEO issues.
   * Saves result to seo_audits table.
   */
  async audit(teamId, url, existingAuditId = null) {
    // ── Mark existing record as "running" so frontend shows progress ──────
    if (existingAuditId) {
      try {
        await prisma.seoAudit.update({
          where: { id: existingAuditId },
          data:  { status: 'running' },
        });
      } catch (err) {
        // Log but don't crash — the audit itself is more important
        logger.warn('Could not mark audit as running', {
          existingAuditId,
          error: err.message,
        });
      }
    }
  
    // ── Fetch the URL ─────────────────────────────────────────────────────
    let html;
    try {
      const response = await axios.get(url, {
        timeout:      10_000,
        headers:      { 'User-Agent': 'AdPilot-SEO-Auditor/1.0' },
        maxRedirects: 5,
      });
      html = response.data;
    } catch (err) {
      // If we have an existing record, mark it failed so the frontend stops polling
      if (existingAuditId) {
        await prisma.seoAudit.update({
          where: { id: existingAuditId },
          data:  {
            status:       'failed',
            technicalIssues: [{ message: `Could not fetch URL: ${err.message}` }],
          },
        }).catch((updateErr) =>
          logger.error('Could not mark audit as failed after fetch error', {
            existingAuditId,
            error: updateErr.message,
          })
        );
      }
      throw AppError.badRequest(`Could not fetch URL: ${err.message}`);
    }
  
    // ── Analyse + score ───────────────────────────────────────────────────
    const $    = cheerio.load(html);
    const issues = this._analyzeHtml($, url);
    const score  = this._calculateScore(issues);
    const recommendations = this._buildRecommendations(issues);
  
    // ── Persist ───────────────────────────────────────────────────────────
    let audit;
  
    if (existingAuditId) {
      // Update the pre-created record (v2 controller flow)
      audit = await prisma.seoAudit.update({
        where: { id: existingAuditId },
        data:  {
          overallScore:    score,
          technicalIssues: issues,
          recommendations,
          status:          'complete',
        },
      });
    } else {
      // Fallback: direct call without a pre-created record (legacy / direct usage)
      audit = await prisma.seoAudit.create({
        data: {
          teamId,
          url,
          overallScore:    score,
          technicalIssues: issues,
          recommendations,
          status:          'complete',
        },
      });
    }
  
    logger.info('SEO audit complete', {
      auditId:    audit.id,
      teamId,
      url,
      score,
      issueCount: issues.length,
      path:       existingAuditId ? 'update' : 'create',
    });
  
    return audit;
  }

  _analyzeHtml($, url) {
    const issues = [];

    // Title tag
    const title = $('title').first().text().trim();
    if (!title) {
      issues.push({ type: 'error', rule: 'missing_title', message: 'Page has no <title> tag' });
    } else if (title.length < TITLE_MIN) {
      issues.push({ type: 'warning', rule: 'title_too_short', message: `Title is ${title.length} chars (min ${TITLE_MIN})`, value: title });
    } else if (title.length > TITLE_MAX) {
      issues.push({ type: 'warning', rule: 'title_too_long', message: `Title is ${title.length} chars (max ${TITLE_MAX})`, value: title });
    }

    // Meta description
    const metaDesc = $('meta[name="description"]').attr('content') || '';
    if (!metaDesc) {
      issues.push({ type: 'error', rule: 'missing_meta_description', message: 'No meta description found' });
    } else if (metaDesc.length < META_DESC_MIN) {
      issues.push({ type: 'warning', rule: 'meta_description_too_short', message: `Meta description is ${metaDesc.length} chars (min ${META_DESC_MIN})` });
    } else if (metaDesc.length > META_DESC_MAX) {
      issues.push({ type: 'warning', rule: 'meta_description_too_long', message: `Meta description is ${metaDesc.length} chars (max ${META_DESC_MAX})` });
    }

    // H1
    const h1Count = $('h1').length;
    if (h1Count === 0) {
      issues.push({ type: 'error', rule: 'missing_h1', message: 'No H1 tag found on page' });
    } else if (h1Count > 1) {
      issues.push({ type: 'warning', rule: 'multiple_h1', message: `${h1Count} H1 tags found — should be exactly 1` });
    }

    // Canonical
    if (!$('link[rel="canonical"]').length) {
      issues.push({ type: 'info', rule: 'missing_canonical', message: 'No canonical URL tag found' });
    }

    // Open Graph
    if (!$('meta[property="og:title"]').length) {
      issues.push({ type: 'info', rule: 'missing_og_tags', message: 'Open Graph tags not found' });
    }

    // Images without alt
    const imgsWithoutAlt = $('img:not([alt])').length;
    if (imgsWithoutAlt > 0) {
      issues.push({ type: 'warning', rule: 'images_missing_alt', message: `${imgsWithoutAlt} image(s) missing alt attribute` });
    }

    // Broken internal links (check for href="#" or empty hrefs)
    const brokenLinks = $('a[href="#"], a[href=""], a:not([href])').length;
    if (brokenLinks > 0) {
      issues.push({ type: 'warning', rule: 'broken_links', message: `${brokenLinks} potentially broken link(s) found` });
    }

    // Schema markup
    if (!$('script[type="application/ld+json"]').length) {
      issues.push({ type: 'info', rule: 'missing_schema', message: 'No structured data (JSON-LD) found' });
    }

    // Viewport meta (mobile)
    if (!$('meta[name="viewport"]').length) {
      issues.push({ type: 'error', rule: 'missing_viewport', message: 'No viewport meta tag — page not mobile-optimized' });
    }

    return issues;
  }

  _calculateScore(issues) {
    const deductions = { error: 15, warning: 7, info: 2 };
    const total = issues.reduce((s, i) => s + (deductions[i.type] || 0), 0);
    return Math.max(0, 100 - total);
  }

  _buildRecommendations(issues) {
    const solutions = {
      missing_title:           'Add a descriptive <title> tag between 50-60 characters.',
      title_too_short:         'Expand your title to at least 50 characters to improve CTR.',
      title_too_long:          'Shorten title to under 60 characters to prevent truncation in SERPs.',
      missing_meta_description:'Write a compelling meta description (120-160 chars) targeting your main keyword.',
      missing_h1:              'Add a single H1 tag that includes your primary keyword.',
      multiple_h1:             'Keep only one H1 per page — use H2/H3 for subheadings.',
      missing_canonical:       'Add <link rel="canonical"> to prevent duplicate content issues.',
      missing_og_tags:         'Add Open Graph tags for better social sharing previews.',
      images_missing_alt:      'Add descriptive alt text to all images for accessibility and SEO.',
      broken_links:            'Fix or remove broken links to improve crawlability.',
      missing_schema:          'Add JSON-LD structured data to enhance SERP appearance.',
      missing_viewport:        'Add <meta name="viewport"> to make the page mobile-friendly.',
    };
    return issues.map((i) => ({ rule: i.rule, recommendation: solutions[i.rule] || 'Review and fix this issue.' }));
  }

  async getAudits(teamId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.seoAudit.findMany({ where: { teamId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.seoAudit.count({ where: { teamId } }),
    ]);
    return { items, total };
  }
}

module.exports = new SeoAuditService();
