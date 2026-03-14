'use strict';

const { getRedis } = require('../../../config/redis');

const TTL_SECONDS = 60 * 60 * 6;

const TECH_PATTERNS = [
  { key: 'google-analytics', name: 'Google Analytics', category: 'analytics', confidence: 'high' },
  { key: 'gtag', name: 'Google Analytics', category: 'analytics', confidence: 'high' },
  { key: 'google-tag-manager', name: 'Google Tag Manager', category: 'tag-manager', confidence: 'high' },
  { key: 'fbevents', name: 'Facebook Pixel', category: 'ads-tracking', confidence: 'high' },
  { key: 'facebook.com/tr', name: 'Facebook Pixel', category: 'ads-tracking', confidence: 'high' },
  { key: 'hotjar', name: 'Hotjar', category: 'behavior-analytics', confidence: 'high' },
  { key: 'intercom', name: 'Intercom', category: 'chat', confidence: 'high' },
  { key: 'hubspot', name: 'HubSpot', category: 'crm', confidence: 'high' },
  { key: 'segment', name: 'Segment', category: 'data-pipeline', confidence: 'high' },
  { key: 'stripe', name: 'Stripe', category: 'payments', confidence: 'medium' },
  { key: 'mixpanel', name: 'Mixpanel', category: 'analytics', confidence: 'high' },
  { key: 'amplitude', name: 'Amplitude', category: 'analytics', confidence: 'high' },
  { key: 'crisp', name: 'Crisp Chat', category: 'chat', confidence: 'high' },
  { key: 'zendesk', name: 'Zendesk', category: 'support', confidence: 'high' },
  { key: 'mailchimp', name: 'Mailchimp', category: 'email', confidence: 'high' },
  { key: 'klaviyo', name: 'Klaviyo', category: 'email', confidence: 'high' },
  { key: 'shopify', name: 'Shopify', category: 'commerce', confidence: 'medium' },
  { key: 'wp-content', name: 'WordPress', category: 'cms', confidence: 'high' },
  { key: 'wp-includes', name: 'WordPress', category: 'cms', confidence: 'high' },
  { key: '_next', name: 'Next.js', category: 'frontend-framework', confidence: 'high' },
  { key: 'next', name: 'Next.js', category: 'frontend-framework', confidence: 'medium' },
  { key: 'react', name: 'React', category: 'frontend-framework', confidence: 'medium' },
  { key: 'angular', name: 'Angular', category: 'frontend-framework', confidence: 'medium' },
  { key: 'vue', name: 'Vue.js', category: 'frontend-framework', confidence: 'medium' },
  { key: 'jquery', name: 'jQuery', category: 'frontend-library', confidence: 'medium' },
  { key: 'bootstrap', name: 'Bootstrap', category: 'ui', confidence: 'medium' },
  { key: 'tailwind', name: 'Tailwind CSS', category: 'ui', confidence: 'medium' },
  { key: 'cloudflare', name: 'Cloudflare', category: 'infrastructure', confidence: 'medium' },
  { key: 'sentry', name: 'Sentry', category: 'observability', confidence: 'high' },
  { key: 'datadog', name: 'Datadog', category: 'observability', confidence: 'high' },
  { key: 'optimizely', name: 'Optimizely', category: 'experimentation', confidence: 'high' },
];

class TechStackSignalAdapter {
  async analyze({ domain, scripts = [], inlineScripts = '', structuredDataTypes = [], internalLinks = [] }) {
    const cacheKey = `research:tech-signals:${domain}`;
    const redis = getRedis();

    try {
      const cached = await redis.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_) {
      // ignore
    }

    const haystack = `${scripts.join(' ')} ${inlineScripts} ${internalLinks.join(' ')}`.toLowerCase();
    const detectedMap = new Map();

    TECH_PATTERNS.forEach((pattern) => {
      if (!haystack.includes(pattern.key)) return;
      if (!detectedMap.has(pattern.name)) {
        detectedMap.set(pattern.name, {
          name: pattern.name,
          category: pattern.category,
          confidence: pattern.confidence,
          source: 'website_crawl',
        });
      }
    });

    structuredDataTypes.forEach((type) => {
      if (!type) return;
      const normalized = Array.isArray(type) ? type.join(', ') : String(type);
      detectedMap.set(`Schema: ${normalized}`, {
        name: `Schema: ${normalized}`,
        category: 'structured-data',
        confidence: 'high',
        source: 'website_crawl',
      });
    });

    const technologies = Array.from(detectedMap.values())
      .sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));

    const categoryCounts = technologies.reduce((acc, item) => {
      acc[item.category] = (acc[item.category] || 0) + 1;
      return acc;
    }, {});

    const result = {
      domain,
      summary: {
        totalTechnologies: technologies.length,
        categories: Object.entries(categoryCounts).map(([category, count]) => ({ category, count })),
        confidence: technologies.length >= 4 ? 'medium' : technologies.length > 0 ? 'low' : 'low',
      },
      technologies,
      evidence: technologies.slice(0, 8).map((item) => `${item.name} detected from public crawl assets.`),
    };

    try {
      await redis.setex(cacheKey, TTL_SECONDS, JSON.stringify(result));
    } catch (_) {
      // ignore
    }

    return result;
  }
}

module.exports = new TechStackSignalAdapter();
