'use strict';

/**
 * CompetitorHijackService — Phase D2
 *
 * Architecture:
 *   Integrates with: SEMrush API / Ahrefs API / SpyFu API (pick one)
 *   Also uses existing CompetitorGapService for keyword gaps
 *   AdSpy: scrape Facebook Ad Library (public API available)
 *     https://www.facebook.com/ads/library/api/
 *   GoogleAdspy: no official API, use SerpAPI for SERP ad data
 *
 * Flow:
 *   User adds competitor domain (already in ResearchPage competitors list)
 *   CompetitorHijackService.analyze(competitorDomain, teamDomain)
 *   Returns: { adExamples[], keywordGaps[], messagingAngles[], winbackTemplates[] }
 *   winbackTemplates use existing ContentBriefService + AdGenerationService
 *
 * TODO Phase D2:
 *   - Integrate Facebook Ad Library API (https://developers.facebook.com/docs/marketing-api/reference/ads-archive)
 *   - Integrate SerpAPI for Google ad intelligence
 *   - Build KeywordGapAnalyzer using SEO audit data
 *   - Wire into ResearchPage "Ad Intelligence" section
 *   - npm install serpapi facebook-nodejs-business-sdk
 */

class CompetitorHijackService {
  /**
   * Generate deterministic mock analysis based on domain name.
   * Consistent results for same domain (uses char codes as seed).
   */
  async analyzeCompetitor(domain, teamId) {
    // Strip protocol and www
    const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];

    // Seeded pseudo-random from domain
    const seed = cleanDomain.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
    const rng  = (min, max) => min + (seed % (max - min + 1));

    const KEYWORD_POOL = [
      `${cleanDomain.split('.')[0]} alternative`,
      `best ${cleanDomain.split('.')[0]} tool`,
      `${cleanDomain.split('.')[0]} pricing`,
      `${cleanDomain.split('.')[0]} vs competitors`,
      `free ${cleanDomain.split('.')[0]}`,
      `${cleanDomain.split('.')[0]} review`,
      `how to use ${cleanDomain.split('.')[0]}`,
      `${cleanDomain.split('.')[0]} tutorial`,
      `${cleanDomain.split('.')[0]} features`,
      `${cleanDomain.split('.')[0]} discount`,
    ];

    const HEADLINE_TEMPLATES = [
      [`${cleanDomain} — Free Trial`, `Top-Rated ${cleanDomain.split('.')[0]} Tool`, `Try ${cleanDomain.split('.')[0]} Today`],
      [`Save 50% on ${cleanDomain}`, `#1 ${cleanDomain.split('.')[0]} Platform`, `Start Free with ${cleanDomain}`],
    ];

    const headlineSet = HEADLINE_TEMPLATES[seed % HEADLINE_TEMPLATES.length];

    const AD_DESCRIPTIONS = [
      `Join 50,000+ teams using ${cleanDomain} to grow revenue. Start your free 14-day trial today.`,
      `The all-in-one ${cleanDomain.split('.')[0]} platform trusted by industry leaders. No credit card required.`,
      `Increase ROI by 3x with ${cleanDomain}. Real-time insights, automated reporting, and 24/7 support.`,
    ];

    const adExamples = [
      { headline: headlineSet[0], description: AD_DESCRIPTIONS[0], cta: 'Start Free Trial', platform: 'Google' },
      { headline: headlineSet[1], description: AD_DESCRIPTIONS[1], cta: 'Get Started',       platform: 'Meta'   },
      { headline: headlineSet[2], description: AD_DESCRIPTIONS[2], cta: 'Learn More',         platform: 'Google' },
    ];

    const topKeywords = KEYWORD_POOL.slice(0, 8);

    const keywordGaps = [
      { keyword: `${cleanDomain.split('.')[0]} alternative`,     theirRank: 1 + (seed % 5),  yourRank: null,           volume: 1200 + rng(0, 3800) },
      { keyword: `${cleanDomain.split('.')[0]} pricing`,          theirRank: 2 + (seed % 4),  yourRank: null,           volume: 880  + rng(0, 2100) },
      { keyword: `best ${cleanDomain.split('.')[0]} tool`,        theirRank: 3 + (seed % 6),  yourRank: 45 + rng(0,30), volume: 650  + rng(0, 1500) },
      { keyword: `${cleanDomain.split('.')[0]} vs adpilot`,       theirRank: 5 + (seed % 8),  yourRank: null,           volume: 320  + rng(0, 480)  },
      { keyword: `free ${cleanDomain.split('.')[0]} trial`,        theirRank: 7 + (seed % 10), yourRank: null,           volume: 240  + rng(0, 360)  },
    ];

    const messagingAngles = ['Price-focused', 'Feature-heavy', 'Trust/testimonials'];

    const winbackOpportunities = [
      {
        angle:            'Price Comparison',
        suggestedHeadline: `Switch from ${cleanDomain} — Save 40%`,
        reason:           `${cleanDomain} uses aggressive pricing messaging. Counter with transparency + savings calculator.`,
      },
      {
        angle:            'Feature Gap Attack',
        suggestedHeadline: `Everything ${cleanDomain} does — and more`,
        reason:           `Their ads emphasize 3 core features. You offer 2 additional capabilities they don't mention.`,
      },
      {
        angle:            'Social Proof',
        suggestedHeadline: `Trusted by 10,000+ teams — unlike ${cleanDomain}`,
        reason:           `Testimonials and case studies outperform their feature-list approach in B2B segments.`,
      },
    ];

    return {
      domain: cleanDomain,
      estimatedAdSpend: `$${(rng(8, 45)).toLocaleString()},${rng(100, 999)}/mo`,
      topKeywords,
      adExamples,
      keywordGaps,
      messagingAngles,
      winbackOpportunities,
    };
  }

  async generateWinbackTemplates(analysis, teamId) {
    // TODO Phase D2: Use ContentBriefService + AdGenerationService with competitor analysis context
    throw new Error('generateWinbackTemplates not yet implemented — Phase D2');
  }
}

module.exports = new CompetitorHijackService();
