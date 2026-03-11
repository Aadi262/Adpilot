'use strict';

const logger = require('../../config/logger');
const anthropic = require('../ai/AnthropicService');
const ollama = require('../ai/OllamaService');

/**
 * SeoSummaryService — generates LLM executive summaries for completed SEO audits.
 *
 * Gated by:
 *   - featureFlags.seoSummary.enabled  (SEO_SUMMARY_ENABLED env var)
 *   - PLAN_LIMITS[team.plan].summaryEnabled
 *   - ANTHROPIC_API_KEY or OLLAMA_URL available
 *
 * The service is called by AuditOrchestrator after scoring completes.
 * It returns a structured JSON object stored in the `executiveSummary` DB column.
 *
 * Output shape:
 * {
 *   executiveSummary: string,   — 2-3 paragraph plain-English summary
 *   priorityRoadmap:  [{ title, description, effort, impact }],  — 5-7 fixes in order
 *   businessImpact:   string,   — 1 paragraph on traffic/ranking/revenue effect
 * }
 *
 * Design:
 *   1. Idempotent — if `executiveSummary` already exists in DB, returns it as-is.
 *   2. Non-fatal — any error returns null, never crashes the audit pipeline.
 *   3. Retry — up to 3 attempts with exponential backoff on API errors.
 *   4. Token-efficient — only the top 5 issues and category scores are included
 *      in the prompt (not the full issues array which can be 100s of items).
 */
class SeoSummaryService {
  get isAvailable() {
    return anthropic.isAvailable || !!process.env.OLLAMA_URL;
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  /**
   * Generate (or return cached) executive summary for an audit.
   *
   * @param {object} auditData     — the full audit result object
   * @param {string} auditData.url
   * @param {number} auditData.overallScore
   * @param {string} auditData.grade
   * @param {object} auditData.issues         — full Issue[] array
   * @param {object} auditData.categoryScores — { categories: {...}, issueCount: {...} }
   * @param {object} auditData.performanceData — Lighthouse result
   * @param {object} [auditData.existingSummary] — if non-null, returned as-is (cache hit)
   * @returns {Promise<SeoSummaryResult|null>}
   */
  async generate(auditData) {
    if (!this.isAvailable) {
      logger.warn('SeoSummaryService.generate: no supported AI provider configured — summary skipped');
      return null;
    }

    // Cache hit: don't regenerate if summary already exists
    if (auditData.existingSummary) {
      logger.debug('SeoSummaryService.generate: cache hit — returning existing summary');
      return auditData.existingSummary;
    }

    const prompt = this._buildPrompt(auditData);

    let lastErr;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        logger.info('SeoSummaryService: requesting executive summary', {
          url: auditData.url,
          score: auditData.overallScore,
          promptChars: prompt.length,
        });

        const result = await this._callApi(prompt);
        logger.info('SeoSummaryService: summary generated', {
          url:    auditData.url,
          score:  auditData.overallScore,
          attempt,
          summaryChars: JSON.stringify(result).length,
        });
        return result;
      } catch (err) {
        lastErr = err;
        logger.warn('SeoSummaryService: API attempt failed', {
          attempt,
          err: err.message,
        });

        if (attempt < 3) {
          // Exponential backoff: 1s, 2s
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }

    logger.error('SeoSummaryService: all retry attempts failed — returning null', {
      url: auditData.url,
      err: lastErr?.message,
    });
    return null;
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Build the prompt from audit data, keeping it compact for token efficiency.
   */
  _buildPrompt(auditData) {
    const { url, overallScore, grade, issues, categoryScores, performanceData } = auditData;

    const issueCount   = categoryScores?.issueCount ?? { critical: 0, high: 0, medium: 0, low: 0, total: 0 };
    const categories   = categoryScores?.categories ?? {};
    const perfMetrics  = performanceData?.metrics ?? {};
    const perfFallback = performanceData?.fallback ?? true;

    // Top 5 issues by severity for the prompt (critical first, then high, etc.)
    const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
    const topIssues = (Array.isArray(issues) ? issues : [])
      .filter((i) => i.description)
      .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99))
      .slice(0, 5)
      .map((i) => `- [${i.severity?.toUpperCase()}] ${i.description}`)
      .join('\n');

    const catSummary = ['technical', 'performance', 'content', 'structure']
      .map((id) => {
        const cat = categories[id];
        if (!cat) return null;
        const label = { technical: 'Technical SEO', performance: 'Performance', content: 'Content', structure: 'Site Structure' }[id];
        return `${label}: ${cat.score ?? '?'}/100${cat.fallback ? ' (fallback)' : ''}`;
      })
      .filter(Boolean)
      .join(', ');

    const perfSummary = perfFallback
      ? 'Performance metrics: unavailable (Lighthouse could not run)'
      : Object.entries(perfMetrics)
          .map(([key, data]) => `${key.toUpperCase()}: ${data.displayValue ?? data.value}`)
          .join(', ');

    return `You are an expert SEO consultant generating a professional audit report summary.

AUDIT DATA:
URL: ${url}
Overall Score: ${overallScore ?? 0}/100 (Grade: ${grade ?? 'F'})
Issue Counts: ${issueCount.critical} critical, ${issueCount.high} high, ${issueCount.medium} medium, ${issueCount.low} low (${issueCount.total} total)
Category Scores: ${catSummary}
${perfSummary}

Top Issues:
${topIssues || '(none detected)'}

Generate a structured JSON response with exactly these three fields:

1. "executiveSummary": A 2-3 paragraph plain-English summary of the site's SEO health. Be specific about what's working and what isn't. Mention the score, grade, and most impactful issues. No jargon.

2. "priorityRoadmap": An array of 5-7 fix items, ordered by business impact (highest first). Each item must have:
   - "title": short action (e.g. "Add meta descriptions to all pages")
   - "description": 1-2 sentence explanation of why this matters
   - "effort": one of "quick-win", "medium", "heavy-lift"
   - "impact": one of "high", "medium", "low"

3. "businessImpact": A single paragraph explaining how the current SEO issues affect organic traffic, search rankings, and potential revenue. Be specific about what fixing the critical issues could achieve.

Respond ONLY with valid JSON. No markdown, no code blocks, no extra text.`;
  }

  async _callApi(prompt) {
    const providers = [
      {
        name: 'anthropic',
        enabled: anthropic.isAvailable,
        request: () => anthropic.generateJSON(prompt, {
          maxTokens: 1500,
          temperature: 0.15,
          timeoutMs: 12000,
          cacheKey: `seo-summary:${this._summaryCacheKey(prompt)}`,
          cacheTtlSeconds: 7 * 24 * 60 * 60,
        }),
        parse: (raw) => raw,
      },
      {
        name: 'ollama',
        enabled: true,
        request: async () => {
          if (!(await ollama.isAvailable())) return null;
          return ollama.generate(prompt, { maxTokens: 1500, temperature: 0.3 });
        },
        parse: (raw) => ollama.parseJSON(raw),
      },
    ];

    const errors = [];
    for (const provider of providers) {
      if (!provider.enabled) continue;

      const rawText = await provider.request();
      if (!rawText) {
        errors.push(`${provider.name}: empty response`);
        continue;
      }

      const parsed = provider.parse(rawText);
      if (!parsed) {
        errors.push(`${provider.name}: non-JSON response`);
        logger.warn('SeoSummaryService: provider returned unparsable summary', {
          provider: provider.name,
          preview: rawText.slice(0, 200),
        });
        continue;
      }

      const normalized = this._normalizeSummary(parsed);
      if (normalized) {
        normalized.provider = provider.name;
        return normalized;
      }

      errors.push(`${provider.name}: missing required fields`);
    }

    throw new Error(`SeoSummaryService: all providers failed (${errors.join('; ')})`);
  }

  _normalizeSummary(parsed) {
    if (!parsed || !parsed.executiveSummary || !Array.isArray(parsed.priorityRoadmap) || !parsed.businessImpact) {
      return null;
    }

    return {
      executiveSummary: String(parsed.executiveSummary),
      priorityRoadmap: parsed.priorityRoadmap.slice(0, 7).map((item) => ({
        title: String(item.title ?? ''),
        description: String(item.description ?? ''),
        effort: ['quick-win', 'medium', 'heavy-lift'].includes(item.effort) ? item.effort : 'medium',
        impact: ['high', 'medium', 'low'].includes(item.impact) ? item.impact : 'medium',
      })),
      businessImpact: String(parsed.businessImpact),
    };
  }

  _summaryCacheKey(prompt) {
    return prompt;
  }
}

module.exports = new SeoSummaryService();
