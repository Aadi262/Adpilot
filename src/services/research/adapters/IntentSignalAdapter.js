'use strict';

const { getRedis } = require('../../../config/redis');

const TTL_SECONDS = 60 * 30;

const COMMERCIAL_TERMS = ['pricing', 'demo', 'book', 'schedule', 'trial', 'get started', 'start free', 'buy', 'contact sales'];
const INFORMATIONAL_TERMS = ['guide', 'learn', 'blog', 'resources', 'academy', 'docs', 'tutorial'];
const PRODUCT_TERMS = ['features', 'integrations', 'compare', 'solutions', 'platform'];
const ENTERPRISE_TERMS = ['enterprise', 'security', 'compliance', 'case study', 'roi', 'team', 'workflow'];

class IntentSignalAdapter {
  async analyze({ domain, title, description, ctas = [], headings = [], siteSurfaces = {}, internalLinks = [], structuredDataTypes = [] }) {
    const cacheKey = `research:intent-signals:${domain}`;
    const redis = getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {
      // ignore
    }

    const ctaText = ctas.map((item) => String(item || '').toLowerCase());
    const headingText = headings.map((item) => String(item?.text || item || '').toLowerCase());
    const combinedText = [title, description, ...ctaText, ...headingText, ...internalLinks].join(' ').toLowerCase();

    const scores = {
      commercial: this._countTerms(combinedText, COMMERCIAL_TERMS) + (siteSurfaces.pricing > 0 ? 2 : 0),
      informational: this._countTerms(combinedText, INFORMATIONAL_TERMS) + (siteSurfaces.blog > 0 || siteSurfaces.docs > 0 ? 2 : 0),
      product: this._countTerms(combinedText, PRODUCT_TERMS) + (siteSurfaces.features > 0 ? 2 : 0),
      enterprise: this._countTerms(combinedText, ENTERPRISE_TERMS) + (siteSurfaces.caseStudies > 0 ? 1 : 0),
    };

    const primaryIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[0]?.[0] || 'commercial';
    const secondaryIntent = Object.entries(scores).sort((a, b) => b[1] - a[1])[1]?.[0] || null;
    const funnelStage = scores.commercial >= 4
      ? 'bottom'
      : scores.product >= 3
      ? 'middle'
      : 'top';

    const structuredSignals = (structuredDataTypes || []).map((type) => Array.isArray(type) ? type.join(', ') : String(type));

    const evidence = [
      ctas[0] ? `Primary CTA observed: "${ctas[0]}".` : null,
      siteSurfaces.pricing > 0 ? 'Pricing pages are present, which signals commercial intent.' : null,
      siteSurfaces.blog > 0 ? 'Blog or educational surfaces are present, which signals educational intent.' : null,
      siteSurfaces.features > 0 ? 'Feature-focused pages suggest active product-comparison intent.' : null,
      structuredSignals.length ? `Structured data includes ${structuredSignals.slice(0, 3).join(', ')}.` : null,
    ].filter(Boolean);

    const result = {
      domain,
      summary: {
        primaryIntent,
        secondaryIntent,
        funnelStage,
        confidence: scores[primaryIntent] >= 4 ? 'medium' : 'low',
      },
      scores,
      evidence,
      signals: {
        commercialCtas: ctas.filter((item) => this._matchesAny(String(item).toLowerCase(), COMMERCIAL_TERMS)).slice(0, 5),
        educationalSurfaces: {
          blog: siteSurfaces.blog || 0,
          docs: siteSurfaces.docs || 0,
        },
        productSurfaces: {
          features: siteSurfaces.features || 0,
          integrations: siteSurfaces.integrations || 0,
          pricing: siteSurfaces.pricing || 0,
        },
      },
    };

    try {
      await redis.setex(cacheKey, TTL_SECONDS, JSON.stringify(result));
    } catch (_) {
      // ignore
    }

    return result;
  }

  _countTerms(text, terms) {
    return terms.reduce((sum, term) => sum + (text.includes(term) ? 1 : 0), 0);
  }

  _matchesAny(text, terms) {
    return terms.some((term) => text.includes(term));
  }
}

module.exports = new IntentSignalAdapter();
