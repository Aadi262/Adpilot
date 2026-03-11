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
        const heroHeading = document.querySelector('main h1, h1')?.innerText?.trim() || '';
        const heroParagraph = document.querySelector('main p, header p, section p')?.innerText?.trim()?.substring(0, 280) || '';

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

        const socialLinks = Array.from(document.querySelectorAll('a[href]'))
          .map((link) => link.href)
          .filter((href) => /linkedin\.com|twitter\.com|x\.com|facebook\.com|instagram\.com|youtube\.com|tiktok\.com/i.test(href))
          .slice(0, 10);

        const internalLinks = Array.from(document.querySelectorAll('a[href]'))
          .map((link) => link.href)
          .filter((href) => href && !href.startsWith('mailto:') && !href.startsWith('tel:'))
          .slice(0, 200);

        const structuredDataTypes = Array.from(document.querySelectorAll('script[type="application/ld+json"]'))
          .flatMap((node) => {
            try {
              const parsed = JSON.parse(node.textContent || 'null');
              const values = Array.isArray(parsed) ? parsed : [parsed];
              return values.flatMap((item) => {
                if (!item) return [];
                if (Array.isArray(item['@graph'])) return item['@graph'].map((row) => row?.['@type']).filter(Boolean);
                return [item['@type']].filter(Boolean);
              });
            } catch {
              return [];
            }
          });

        return {
          title:         document.title,
          description:   getMeta('description') || getMeta('og:description'),
          ogTitle:       getMeta('og:title'),
          keywords:      getMeta('keywords'),
          heroHeading,
          heroParagraph,
          headings,
          ctas,
          scripts,
          inlineScripts,
          socialLinks,
          internalLinks,
          structuredDataTypes,
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
      const socialLinks = [...new Set(extracted.socialLinks || [])].slice(0, 8);
      const internalLinks = this._normalizeInternalLinks(extracted.internalLinks || [], url);
      const siteSurfaces = this._buildSiteSurfaces(internalLinks);
      const crawlAssets = await this._fetchSiteAssets(url);
      const structuredDataTypes = [...new Set((extracted.structuredDataTypes || []).flatMap((item) => Array.isArray(item) ? item : [item]).filter(Boolean))].slice(0, 10);
      const companySnapshot = this._buildCompanySnapshot({
        domain,
        title: extracted.title,
        description: extracted.description,
        heroHeading: extracted.heroHeading,
        heroParagraph: extracted.heroParagraph,
        ctas: uniqueCtas,
        headings: extracted.headings,
      });
      const contentFootprint = this._buildContentFootprint(siteSurfaces, internalLinks, extracted.headings);

      return {
        domain,
        url,
        title:       extracted.title,
        description: extracted.description,
        heroHeading: extracted.heroHeading || null,
        heroParagraph: extracted.heroParagraph || null,
        headings:    extracted.headings,
        ctas:        uniqueCtas,
        topKeywords,
        techStack,
        linkCount:   extracted.linkCount,
        socialLinks,
        internalLinks: internalLinks.slice(0, 30),
        siteSurfaces,
        contentFootprint,
        companySnapshot,
        structuredDataTypes,
        robotsTxtPresent: crawlAssets.robotsTxtPresent,
        sitemapPresent: crawlAssets.sitemapPresent,
        sitemapUrlCount: crawlAssets.sitemapUrlCount,
        crawlCoverage: crawlAssets.crawlCoverage,
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

  async _fetchSiteAssets(url) {
    try {
      const origin = new URL(url).origin;
      const [robots, sitemap] = await Promise.allSettled([
        this._fetchText(`${origin}/robots.txt`),
        this._fetchText(`${origin}/sitemap.xml`),
      ]);

      const robotsTxt = robots.status === 'fulfilled' ? robots.value : null;
      const sitemapXml = sitemap.status === 'fulfilled' ? sitemap.value : null;
      const sitemapUrlCount = (sitemapXml?.match(/<loc>/g) || []).length;

      return {
        robotsTxtPresent: !!robotsTxt,
        sitemapPresent: !!sitemapXml,
        sitemapUrlCount,
        crawlCoverage: {
          robots: !!robotsTxt,
          sitemap: !!sitemapXml,
          sitemapUrlCount,
        },
      };
    } catch (err) {
      logger.debug('CompetitorAnalyzer: site asset fetch failed', { url, error: err.message });
      return {
        robotsTxtPresent: false,
        sitemapPresent: false,
        sitemapUrlCount: 0,
        crawlCoverage: { robots: false, sitemap: false, sitemapUrlCount: 0 },
      };
    }
  }

  async _fetchText(url) {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; AdPilot/1.0)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    return res.text();
  }

  _normalizeInternalLinks(links, baseUrl) {
    const baseHost = new URL(baseUrl).hostname.replace(/^www\./, '');
    const seen = new Set();
    const output = [];

    for (const href of links) {
      try {
        const parsed = new URL(href, baseUrl);
        const host = parsed.hostname.replace(/^www\./, '');
        if (host !== baseHost) continue;
        const normalized = `${parsed.origin}${parsed.pathname}`.replace(/\/$/, '') || parsed.origin;
        if (seen.has(normalized)) continue;
        seen.add(normalized);
        output.push(normalized);
      } catch {
        // skip invalid links
      }
    }

    return output;
  }

  _buildSiteSurfaces(internalLinks) {
    const counters = {
      pricing: 0,
      blog: 0,
      docs: 0,
      features: 0,
      caseStudies: 0,
      integrations: 0,
    };

    for (const link of internalLinks) {
      const lower = link.toLowerCase();
      if (/pricing|plans/.test(lower)) counters.pricing += 1;
      if (/blog|resources|guides|learn/.test(lower)) counters.blog += 1;
      if (/docs|documentation|academy|help/.test(lower)) counters.docs += 1;
      if (/features|solutions|platform|product/.test(lower)) counters.features += 1;
      if (/case-study|case-studies|customers|success-story/.test(lower)) counters.caseStudies += 1;
      if (/integrations|partners|apps/.test(lower)) counters.integrations += 1;
    }

    return counters;
  }

  _buildCompanySnapshot({ domain, title, description, heroHeading, heroParagraph, ctas, headings }) {
    const primaryOffer = heroHeading || title || domain;
    const positioning = description || heroParagraph || headings?.[0]?.text || '';
    const audienceSource = [heroParagraph, ...(ctas || []), ...(headings || []).map((item) => item.text)].join(' ').toLowerCase();
    let targetAudience = 'general marketers';
    if (/agency|agencies/.test(audienceSource)) targetAudience = 'agencies';
    else if (/ecommerce|shopify|store/.test(audienceSource)) targetAudience = 'ecommerce teams';
    else if (/b2b|sales|revenue/.test(audienceSource)) targetAudience = 'B2B growth teams';
    else if (/seo|content/.test(audienceSource)) targetAudience = 'SEO and content teams';

    return {
      primaryOffer,
      positioning,
      targetAudience,
      heroHeading: heroHeading || null,
      primaryCallToAction: ctas?.[0] || null,
    };
  }

  _buildContentFootprint(siteSurfaces, internalLinks, headings) {
    return {
      totalInternalPagesObserved: internalLinks.length,
      blogPresence: siteSurfaces.blog > 0,
      pricingPresence: siteSurfaces.pricing > 0,
      docsPresence: siteSurfaces.docs > 0,
      featurePagePresence: siteSurfaces.features > 0,
      caseStudyPresence: siteSurfaces.caseStudies > 0,
      headlineCount: headings?.length || 0,
      contentTypes: [
        siteSurfaces.blog > 0 ? 'blog' : null,
        siteSurfaces.pricing > 0 ? 'pricing' : null,
        siteSurfaces.docs > 0 ? 'docs' : null,
        siteSurfaces.features > 0 ? 'features' : null,
        siteSurfaces.caseStudies > 0 ? 'case-studies' : null,
      ].filter(Boolean),
    };
  }
}

module.exports = new CompetitorAnalyzer();
