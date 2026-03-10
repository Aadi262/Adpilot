'use strict';

const logger             = require('../../config/logger');
const CompetitorAnalyzer = require('./CompetitorAnalyzer');
const gemini             = require('./GeminiService');
const ollama             = require('./OllamaService');
const huggingface        = require('./HuggingFaceService');
const anthropic          = require('./AnthropicService');
const serpIntelligence   = require('../seo/SerpIntelligenceService');

class CompetitorHijackService {
  /**
   * Analyze a competitor domain.
   * 1. Puppeteer crawl for real page data (title, description, CTAs, tech stack, keywords)
   * 2. Gemini AI for strategic insights (keyword gaps, messaging angles, suggested ads)
   * 3. Falls back to smart mock if crawl fails (e.g. site blocks bots)
   */
  async analyzeCompetitor(domain, teamId, mode = 'attack') {
    const cleanDomain = domain
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0]
      .trim();

    let crawlData = null;

    // Attempt real crawl
    try {
      crawlData = await CompetitorAnalyzer.analyze(cleanDomain);
    } catch (err) {
      logger.warn('CompetitorHijackService: crawl failed, using mock fallback', {
        domain: cleanDomain,
        error:  err.message,
      });
    }

    // If crawl succeeded, optionally enrich with AI insights (Ollama → Gemini)
    if (crawlData) {
      let aiInsights = null;
      const enrichedKeywords = await serpIntelligence.enrichKeywordList((crawlData.topKeywords || []).slice(0, 8));
      const aiParams = {
        domain:      crawlData.domain,
        title:       crawlData.title,
        description: crawlData.description,
        ctas:        crawlData.ctas,
        topKeywords: enrichedKeywords.length ? enrichedKeywords : crawlData.topKeywords,
        techStack:   crawlData.techStack,
        headings:    crawlData.headings,
      };

      // 1. Try Ollama (local, free)
      if (await ollama.isAvailable()) {
        aiInsights = await ollama.analyzeCompetitor(aiParams);
      }
      // 2. Try Gemini (free key)
      if (!aiInsights && gemini.isAvailable) {
        aiInsights = await gemini.analyzeCompetitor(aiParams);
      }

      // 3. Try HuggingFace (free key, Mistral-7B)
      if (!aiInsights && huggingface.isAvailable) {
        aiInsights = await huggingface.analyzeCompetitor(aiParams);
      }

      // 4. Try Anthropic Claude (paid key, reliable)
      if (!aiInsights && anthropic.isAvailable) {
        aiInsights = await anthropic.analyzeCompetitor(aiParams);
      }

      // Build keyword gaps from crawl data (real keywords found on their site)
      const keywordGaps = (crawlData.topKeywords || []).slice(0, 5).map((kw, i) => ({
        keyword:   kw.word,
        theirRank: i + 1, // they rank for these (found prominently on their site)
        yourRank:  null,  // we don't know without SERP data
        volume:    null,  // we don't know without SEMrush/SERP data
        source:    'crawl',
      }));

      // Use Gemini keyword gaps if available (richer data)
      const finalKeywordGaps = aiInsights?.keywordGaps
        ? aiInsights.keywordGaps.map(g => ({
            keyword:    g.keyword,
            theirRank:  1,
            yourRank:   null,
            volume:     null,
            opportunity: g.opportunity,
            difficulty:  g.difficulty,
            source:      'ai',
          }))
        : keywordGaps;

      // Build ad examples from Gemini suggested ads or heading-based mock
      const adExamples = aiInsights?.suggestedAds
        ? aiInsights.suggestedAds.map((ad, i) => ({
            headline:    ad.headline,
            description: ad.body,
            cta:         crawlData.ctas?.[0] || 'Learn More',
            platform:    i % 2 === 0 ? 'Google' : 'Meta',
            source:      'ai',
          }))
        : this._buildAdExamplesFromCrawl(crawlData);

      const baseResult = {
        domain:            crawlData.domain,
        url:               crawlData.url,
        title:             crawlData.title,
        description:       crawlData.description,
        headings:          crawlData.headings,
        ctas:              crawlData.ctas,
        topKeywords:       enrichedKeywords.length ? enrichedKeywords : crawlData.topKeywords,
        techStack:         crawlData.techStack,
        linkCount:         crawlData.linkCount,
        hasAnalytics:      crawlData.hasAnalytics,
        hasFacebookPixel:  crawlData.hasFacebookPixel,
        hasRetargeting:    crawlData.hasRetargeting,
        // Ad spend is NEVER faked
        estimatedAdSpend:  null,
        adSpend:           null,
        adSpendNote:       crawlData.adSpendNote,
        // Results
        adExamples,
        keywordGaps:       finalKeywordGaps,
        messagingAngles:   aiInsights?.messagingAngles || this._buildAnglesFromCrawl(crawlData),
        weaknesses:        aiInsights?.weaknesses || null,
        strengths:         aiInsights?.strengths || null,
        winbackOpportunities: this._buildWinbackFromData(crawlData, aiInsights),
        // Data quality flags
        isReal:     true,
        hasAiInsights: !!aiInsights,
        crawledAt:  crawlData.crawledAt,
      };

      return mode === 'overview'
        ? this._buildOverviewResult(baseResult, crawlData, aiInsights)
        : this._buildAttackResult(baseResult, crawlData, aiInsights);
    }

    // Full fallback: smart mock (deterministic, honest label)
    const fallback = this._mockFallback(cleanDomain);
    return mode === 'overview'
      ? this._buildOverviewResult(fallback, fallback, null)
      : this._buildAttackResult(fallback, fallback, null);
  }

  _buildOverviewResult(baseResult, crawlData, aiInsights) {
    const topKeywords = (baseResult.topKeywords || []).slice(0, 10).map((kw) => ({
      keyword: kw.keyword || kw.word,
      volume: kw.searchVolume ?? null,
      position: kw.position ?? null,
      serpFeatures: kw.serpFeatures ?? [],
    }));

    return {
      ...baseResult,
      mode: 'overview',
      trafficEstimate: null,
      threatLevel: this._computeThreatLevel(topKeywords, crawlData),
      socialLinks: [],
      structuredDataPresent: Boolean(crawlData?.headings?.length),
      pageSpeedScore: null,
      metaTags: {
        title: crawlData.title || null,
        description: crawlData.description || null,
      },
      contentStrategy: {
        headlineCount: crawlData.headings?.length || 0,
        ctaCount: crawlData.ctas?.length || 0,
        contentTypes: this._detectContentTypes(crawlData),
        topics: topKeywords.slice(0, 8),
      },
      strengths: baseResult.strengths || this._buildOverviewStrengths(crawlData),
      weaknesses: baseResult.weaknesses || this._buildOverviewWeaknesses(crawlData),
      topKeywords,
      adExamples: [],
      keywordGaps: [],
      winbackOpportunities: [],
    };
  }

  _buildAttackResult(baseResult, crawlData, aiInsights) {
    const researchBasis = this._buildResearchBasis(baseResult, crawlData);
    const attackVectors = this._buildAttackVectors(baseResult, crawlData, aiInsights);

    return {
      ...baseResult,
      mode: 'attack',
      researchBasis,
      attackVectors,
      weakestPages: (crawlData.headings || []).slice(0, 3).map((h, idx) => ({
        page: h.text,
        reason: idx === 0 ? 'Weak differentiation in headline copy' : 'Likely low CTR due to generic positioning',
      })),
      counterAdTemplates: (baseResult.adExamples || []).slice(0, 3).map((ad, idx) => ({
        angle: ['Relevance', 'Unique value', 'Stronger CTA'][idx] || 'Counter-positioning',
        headline: `${(ad.headline || baseResult.domain).slice(0, 28)}`.trim(),
        description: (ad.description || `Choose an alternative to ${baseResult.domain} with clearer ROI and faster setup.`).slice(0, 88),
      })),
      timingInsights: baseResult.hasAiInsights
        ? ['Paid competition exists on this SERP, indicating active budget pressure.', 'Monitor this keyword weekly for new ad copy changes.']
        : ['Live spend timing data is unavailable without ad network transparency APIs.'],
    };
  }

  _buildResearchBasis(baseResult, crawlData) {
    const topKeyword = baseResult.topKeywords?.[0]?.keyword || baseResult.topKeywords?.[0]?.word || null;
    const secondKeyword = baseResult.topKeywords?.[1]?.keyword || baseResult.topKeywords?.[1]?.word || null;
    return [
      topKeyword ? `Top visible keyword on-site: "${topKeyword}".` : null,
      secondKeyword ? `Secondary keyword cluster: "${secondKeyword}".` : null,
      crawlData.ctas?.[0] ? `Primary CTA observed: "${crawlData.ctas[0]}".` : null,
      crawlData.headings?.[0]?.text ? `Homepage lead headline: "${crawlData.headings[0].text}".` : null,
      crawlData.techStack?.length ? `Detected stack includes ${crawlData.techStack.slice(0, 3).join(', ')}.` : null,
    ].filter(Boolean);
  }

  _buildAttackVectors(baseResult, crawlData, aiInsights) {
    const topKeywords = (baseResult.topKeywords || []).slice(0, 3);
    const ctas = crawlData.ctas || [];
    const weaknesses = aiInsights?.weaknesses || [];

    return topKeywords.map((kw, idx) => {
      const keyword = kw.keyword || kw.word;
      const cta = ctas[idx] || ctas[0] || 'Book a demo';
      return {
        title: `Capture ${keyword} demand`,
        evidence: `They surface "${keyword}" prominently and pair it with "${cta}" in their conversion path.`,
        move: weaknesses[idx]
          ? `Counter their weakness: ${weaknesses[idx]}`
          : `Build a dedicated landing page and paid ad group around "${keyword}" with a stronger proof point than "${cta}".`,
      };
    }).filter((item) => item.title);
  }

  _computeThreatLevel(topKeywords, crawlData) {
    const keywordCount = topKeywords.length;
    const techScore = crawlData.techStack?.length || 0;
    const ctaScore = crawlData.ctas?.length || 0;
    const total = keywordCount + techScore + ctaScore;
    if (total >= 20) return 'Critical';
    if (total >= 14) return 'High';
    if (total >= 8) return 'Medium';
    return 'Low';
  }

  _detectContentTypes(crawlData) {
    const types = [];
    if (crawlData.headings?.some((h) => /blog|guide|learn/i.test(h.text))) types.push('educational');
    if (crawlData.ctas?.some((cta) => /demo|book|schedule/i.test(cta))) types.push('sales-led');
    if (crawlData.ctas?.some((cta) => /pricing|free trial|start/i.test(cta))) types.push('conversion-led');
    return types.length ? types : ['product-led'];
  }

  _buildOverviewStrengths(crawlData) {
    const strengths = [];
    if (crawlData.techStack?.length) strengths.push('Modern marketing and analytics stack detected');
    if (crawlData.ctas?.length >= 3) strengths.push('Strong conversion path with multiple CTA entry points');
    if (crawlData.headings?.length >= 5) strengths.push('Content structure is dense enough to support topic coverage');
    return strengths;
  }

  _buildOverviewWeaknesses(crawlData) {
    const weaknesses = [];
    if (!crawlData.techStack?.includes('Google Analytics')) weaknesses.push('Limited analytics stack detected');
    if ((crawlData.ctas?.length || 0) < 2) weaknesses.push('Weak conversion path with too few CTA variations');
    if ((crawlData.headings?.length || 0) < 4) weaknesses.push('Thin on-page structure suggests shallow topical depth');
    return weaknesses;
  }

  _buildAdExamplesFromCrawl(crawl) {
    const name  = crawl.title?.split(/[-|–]/)[0]?.trim() || crawl.domain;
    const ctas  = crawl.ctas?.slice(0, 3) || ['Learn More'];
    const h1    = crawl.headings?.find(h => h.tag === 'H1')?.text || name;

    return [
      { headline: h1.substring(0, 40),                                platform: 'Google', cta: ctas[0] || 'Learn More',      source: 'crawl' },
      { headline: `${name} — ${crawl.ctas?.[0] || 'Try for Free'}`.substring(0, 40), platform: 'Meta',   cta: ctas[1] || 'Get Started',    source: 'crawl' },
      { headline: `${name} — See How It Works`.substring(0, 40),     platform: 'Google', cta: ctas[2] || 'Watch Demo',       source: 'crawl' },
    ];
  }

  _buildAnglesFromCrawl(crawl) {
    const angles = [];
    if (crawl.hasFacebookPixel)  angles.push('Retargeting-heavy');
    if (crawl.hasAnalytics)      angles.push('Data-driven');
    if (crawl.ctas?.some(c => /free/i.test(c)))    angles.push('Free trial / freemium');
    if (crawl.ctas?.some(c => /demo/i.test(c)))    angles.push('Demo-led sales');
    if (crawl.ctas?.some(c => /pricing/i.test(c))) angles.push('Pricing-forward');
    if (angles.length === 0) angles.push('Feature-focused', 'Trust & credibility', 'ROI-driven');
    return angles.slice(0, 5);
  }

  _buildWinbackFromData(crawl, aiInsights) {
    const primaryKeyword = crawl.topKeywords?.[0]?.keyword || crawl.topKeywords?.[0]?.word || null;
    const secondaryKeyword = crawl.topKeywords?.[1]?.keyword || crawl.topKeywords?.[1]?.word || null;
    const primaryCta = crawl.ctas?.[0] || 'Book a demo';
    const secondaryCta = crawl.ctas?.[1] || 'Start free trial';
    const headlineAnchor = crawl.headings?.[0]?.text?.substring(0, 72) || crawl.title || crawl.domain;
    const weaknesses = aiInsights?.weaknesses || [];

    const opportunities = [
      primaryKeyword ? {
        angle: 'Keyword Intercept',
        suggestedHeadline: `Own "${primaryKeyword}" before they do`,
        reason: `They visibly emphasize "${primaryKeyword}". Build a tighter landing page and ad set around that exact demand instead of broad competitor messaging.`,
        action: `Launch a dedicated ${primaryKeyword} comparison page and pair it with exact-match search ads.`,
        targetKeyword: primaryKeyword,
        source: weaknesses.length ? 'ai' : 'crawl',
      } : null,
      {
        angle: 'CTA Counter',
        suggestedHeadline: `Beat their "${primaryCta}" offer`,
        reason: `Their conversion path leans on "${primaryCta}". Counter with a stronger CTA that reduces friction and makes the next step clearer.`,
        action: `Test a direct-response alternative to "${primaryCta}" such as "${secondaryCta}" with proof and urgency near the fold.`,
        targetKeyword: secondaryKeyword,
        source: weaknesses.length ? 'ai' : 'crawl',
      },
      {
        angle: 'Messaging Gap',
        suggestedHeadline: `Turn "${headlineAnchor.substring(0, 38)}" into your angle`,
        reason: weaknesses[0]
          ? `Their weakness is clear: ${weaknesses[0]}. Position against that gap with concrete proof, pricing clarity, or faster onboarding.`
          : `Their current headline focus is "${headlineAnchor}". Reframe the same category promise with a sharper outcome and clearer differentiation.`,
        action: `Build one counter-campaign that directly addresses the missing promise in their current positioning.`,
        targetKeyword: secondaryKeyword || primaryKeyword,
        source: weaknesses.length ? 'ai' : 'crawl',
      },
    ].filter(Boolean);

    return opportunities.slice(0, 3);
  }

  /**
   * Fallback when Puppeteer crawl fails (site blocks bots, timeout, etc.)
   * Uses deterministic mock — clearly labelled as sample data.
   */
  _mockFallback(cleanDomain) {
    const seed = cleanDomain.split('').reduce((acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0);
    const rng  = (min, max) => min + (seed % (max - min + 1));
    const name = cleanDomain.split('.')[0];

    return {
      domain:      cleanDomain,
      url:         `https://${cleanDomain}`,
      title:       null,
      description: null,
      headings:    [],
      ctas:        [],
      topKeywords: [
        { word: `${name} alternative`,  frequency: 12 },
        { word: `${name} pricing`,       frequency: 8  },
        { word: `best ${name} tool`,     frequency: 6  },
        { word: `${name} review`,        frequency: 5  },
        { word: `${name} features`,      frequency: 4  },
      ],
      techStack:        [],
      estimatedAdSpend: null,
      adSpend:          null,
      adSpendNote:      'Real ad spend data requires SEMrush or SpyFu API ($39–119/mo)',
      adExamples: [
        { headline: `${name} — Free Trial`,               description: `Join thousands using ${name}.`, cta: 'Start Free Trial', platform: 'Google', source: 'mock' },
        { headline: `#1 ${name} Platform`,                description: `Trusted by industry leaders.`,   cta: 'Get Started',     platform: 'Meta',   source: 'mock' },
        { headline: `Try ${name} Today`,                   description: `Real-time insights, 24/7 support.`, cta: 'Learn More', platform: 'Google', source: 'mock' },
      ],
      keywordGaps: [
        { keyword: `${name} alternative`,    theirRank: 1 + (seed % 5),  yourRank: null, volume: 1200 + rng(0, 3800), source: 'mock' },
        { keyword: `${name} pricing`,         theirRank: 2 + (seed % 4),  yourRank: null, volume: 880  + rng(0, 2100), source: 'mock' },
        { keyword: `best ${name} tool`,       theirRank: 3 + (seed % 6),  yourRank: null, volume: 650  + rng(0, 1500), source: 'mock' },
      ],
      messagingAngles:      ['Price-focused', 'Feature-heavy', 'Trust/testimonials'],
      winbackOpportunities: [
        { angle: 'Price Comparison', suggestedHeadline: `Switch from ${name} — Save 40%`, reason: 'Counter with transparency + savings calculator.', source: 'mock' },
        { angle: 'Feature Gap',      suggestedHeadline: `Everything ${name} does — and more`, reason: 'Highlight capabilities they don\'t mention.', source: 'mock' },
      ],
      isReal:        false,
      hasAiInsights: false,
      crawlFailed:   true,
      crawlFailNote: 'Site blocked automated crawling. Showing sample data structure.',
    };
  }
}

module.exports = new CompetitorHijackService();
