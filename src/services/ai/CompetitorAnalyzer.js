'use strict';

const logger = require('../../config/logger');

// Tech stack patterns to detect from script URLs / page source
const TECH_MAP = {
  'google-analytics': 'Google Analytics', 'gtag': 'Google Analytics',
  'fbevents':         'Facebook Pixel',    'facebook.com/tr': 'Facebook Pixel',
  'hotjar':           'Hotjar',            'intercom':        'Intercom',
  'hubspot':          'HubSpot',           'segment':         'Segment',
  'stripe':           'Stripe',            'mixpanel':        'Mixpanel',
  'amplitude':        'Amplitude',         'crisp':           'Crisp Chat',
  'zendesk':          'Zendesk',           'mailchimp':       'Mailchimp',
  'klaviyo':          'Klaviyo',           'shopify':         'Shopify',
  'wp-content':       'WordPress',         'wp-includes':     'WordPress',
  'react':            'React',             'next':            'Next.js',
  'angular':          'Angular',           'vue':             'Vue.js',
  'jquery':           'jQuery',            'bootstrap':       'Bootstrap',
  'tailwind':         'Tailwind CSS',      'cloudflare':      'Cloudflare',
  'sentry':           'Sentry',            'datadog':         'Datadog',
  'optimizely':       'Optimizely',        'google-tag':      'Google Tag Manager',
  'remarketing':      'Google Remarketing',
};

const STOP_WORDS = new Set([
  'that','this','with','from','your','have','will','been','more','about',
  'their','they','what','which','when','were','there','just','also','into',
  'than','then','them','these','those','would','could','should','other',
  'some','only','very','most','such','each','much','like','over','after',
  'before','does','make','made','through','where','come','many','well',
  'back','even','want','because','here','take','every','find','know',
  'need','still','between','same','being','under','while','help','best',
  'good','great','page','site','website','home','click','read','learn',
  'more','our','are','the','for','and','you',
]);

class CompetitorAnalyzer {
  /**
   * Crawl a competitor site and extract real, publicly visible data.
   * Returns structured data about their page, keywords, tech stack, CTAs.
   *
   * NOTE: Ad spend data is NOT available without paid APIs (SEMrush/SpyFu).
   * We are transparent about this in the response.
   */
  async analyze(domain) {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    let browser;

    try {
      // Lazy-require puppeteer so the service still boots without it
      const puppeteer = require('puppeteer');

      browser = await puppeteer.launch({
        headless: 'new',
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
        ],
        timeout: 30000,
      });

      const page = await browser.newPage();
      await page.setUserAgent(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      );

      // Block heavy resources to speed up crawl
      await page.setRequestInterception(true);
      page.on('request', (req) => {
        const type = req.resourceType();
        if (['image', 'font', 'media', 'stylesheet'].includes(type)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 20000 });

      const extracted = await page.evaluate(() => {
        const getMeta = (name) => {
          const el = document.querySelector(
            `meta[name="${name}"], meta[property="${name}"], meta[property="og:${name}"]`
          );
          return el?.content || null;
        };

        const bodyText = document.body?.innerText?.substring(0, 8000) || '';

        const headings = Array.from(document.querySelectorAll('h1, h2, h3'))
          .map(h => ({ tag: h.tagName, text: h.innerText?.trim()?.substring(0, 200) }))
          .filter(h => h.text && h.text.length > 2)
          .slice(0, 20);

        const CTA_KEYWORDS = ['free','trial','demo','start','sign','get','buy',
          'pricing','book','schedule','contact','download','try','join'];
        const ctas = Array.from(document.querySelectorAll('a, button'))
          .filter(el => {
            const t = (el.innerText || '').toLowerCase();
            return CTA_KEYWORDS.some(k => t.includes(k)) && t.length < 80;
          })
          .map(el => el.innerText?.trim()?.substring(0, 100))
          .filter(Boolean)
          .slice(0, 12);

        const scripts = Array.from(document.querySelectorAll('script[src]'))
          .map(s => s.src)
          .slice(0, 50);

        const inlineScripts = Array.from(document.querySelectorAll('script:not([src])'))
          .map(s => s.textContent?.substring(0, 500) || '')
          .join(' ');

        return {
          title:         document.title,
          description:   getMeta('description') || getMeta('og:description'),
          ogTitle:       getMeta('og:title'),
          keywords:      getMeta('keywords'),
          headings,
          ctas,
          scripts,
          inlineScripts,
          bodyText,
          linkCount: document.querySelectorAll('a[href]').length,
        };
      });

      await browser.close();
      browser = null;

      // Detect tech stack
      const allScripts = (extracted.scripts.join(' ') + ' ' + extracted.inlineScripts).toLowerCase();
      const techStack = [];
      for (const [pattern, name] of Object.entries(TECH_MAP)) {
        if (allScripts.includes(pattern) && !techStack.includes(name)) {
          techStack.push(name);
        }
      }

      // Keyword frequency from visible text
      const allText = [
        extracted.title,
        extracted.description,
        extracted.ogTitle,
        ...extracted.headings.map(h => h.text),
        extracted.bodyText,
      ].filter(Boolean).join(' ').toLowerCase();

      const words = allText
        .split(/[\s,.;:!?()\[\]{}"'\-\/]+/)
        .filter(w => w.length > 3 && !STOP_WORDS.has(w) && /^[a-z]+$/.test(w));

      const freq = {};
      words.forEach(w => { freq[w] = (freq[w] || 0) + 1; });

      const topKeywords = Object.entries(freq)
        .filter(([, c]) => c >= 2)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 25)
        .map(([word, frequency]) => ({ word, frequency }));

      // Dedupe CTAs
      const uniqueCtas = [...new Set(extracted.ctas)].slice(0, 8);

      return {
        domain,
        url,
        title:       extracted.title,
        description: extracted.description,
        headings:    extracted.headings,
        ctas:        uniqueCtas,
        topKeywords,
        techStack,
        linkCount:   extracted.linkCount,
        hasAnalytics:      techStack.includes('Google Analytics'),
        hasFacebookPixel:  techStack.includes('Facebook Pixel'),
        hasRetargeting:    techStack.includes('Facebook Pixel') || allScripts.includes('remarketing'),
        // Honest: we cannot get ad spend without paid APIs
        adSpend:     null,
        adSpendNote: 'Real ad spend data requires SEMrush or SpyFu API ($39–119/mo)',
        crawledAt:   new Date().toISOString(),
        isReal:      true,
      };

    } catch (err) {
      if (browser) {
        await browser.close().catch(() => {});
      }
      logger.error('CompetitorAnalyzer.analyze failed', { domain, error: err.message });
      // Re-throw so caller can decide to fall back to mock
      throw err;
    }
  }
}

module.exports = new CompetitorAnalyzer();
