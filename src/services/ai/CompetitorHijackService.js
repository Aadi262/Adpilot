'use strict';

const logger             = require('../../config/logger');
const AppError           = require('../../common/AppError');
const CompetitorAnalyzer = require('./CompetitorAnalyzer');
const groq               = require('./GroqService');
const cerebra            = require('./CerebraService');
const together           = require('./TogetherAIService');
const gemini             = require('./GeminiService');
const anthropic          = require('./AnthropicService');
const teamContextService = require('./TeamContextService');
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
      logger.warn('CompetitorHijackService: crawl failed', {
        domain: cleanDomain,
        error:  err.message,
      });
    }

    if (!crawlData) {
      throw AppError.serviceUnavailable('Could not crawl this competitor site. Live ad intelligence needs a crawlable page, so no fallback template was returned.');
    }

    if (crawlData) {
      let aiInsights = null;
      const teamContext = await teamContextService.getCompetitorContext(teamId, cleanDomain);
      const serpEnrichment = await serpIntelligence.enrichKeywordListWithMeta((crawlData.topKeywords || []).slice(0, 8), cleanDomain);
      const enrichedKeywords = serpEnrichment.keywords || [];
      const mergedKeywords = this._mergeKeywordEvidence(crawlData.topKeywords || [], enrichedKeywords);
      const researchBasis = this._buildResearchBasis({ topKeywords: mergedKeywords }, crawlData);
      const aiParams = {
        domain:      crawlData.domain,
        title:       crawlData.title,
        description: crawlData.description,
        ctas:        crawlData.ctas,
        topKeywords: mergedKeywords,
        techStack:   crawlData.techStack,
        headings:    crawlData.headings,
        researchBasis,
        teamMemory:  teamContextService.formatCompetitorContext(teamContext),
      };

      // AI chain: Groq (R1) → Cerebras (Qwen3/Llama3.3) → Together AI (R1 full) → Gemini → Anthropic
      const aiProviders = [
        groq.isAvailable      ? () => groq.analyzeCompetitor(aiParams)      : null,
        cerebra.isAvailable   ? () => cerebra.analyzeCompetitor(aiParams)   : null,
        together.isAvailable  ? () => together.analyzeCompetitor(aiParams)  : null,
        gemini.isAvailable    ? () => gemini.analyzeCompetitor(aiParams)    : null,
        anthropic.isAvailable ? () => anthropic.analyzeCompetitor(aiParams) : null,
      ].filter(Boolean);

      for (const fn of aiProviders) {
        try {
          aiInsights = await fn();
          if (aiInsights) break;
        } catch {
          aiInsights = null;
        }
      }

      const finalKeywordGaps = this._buildKeywordGaps(mergedKeywords, aiInsights);
      const observedKeywords = mergedKeywords.map((item) => item.keyword).filter(Boolean);
      const aiWinbacks = this._normalizeWinbackOpportunities(aiInsights?.winbackOpportunities, observedKeywords);
      const counterAdTemplates = this._normalizeCounterAds(aiInsights?.suggestedAds);

      const baseResult = {
        domain:            crawlData.domain,
        url:               crawlData.url,
        title:             crawlData.title,
        description:       crawlData.description,
        headings:          crawlData.headings,
        ctas:              crawlData.ctas,
        topKeywords:       mergedKeywords,
        techStack:         crawlData.techStack,
        linkCount:         crawlData.linkCount,
        socialLinks:       crawlData.socialLinks || [],
        internalLinks:     crawlData.internalLinks || [],
        siteSurfaces:      crawlData.siteSurfaces || {},
        contentFootprint:  crawlData.contentFootprint || {},
        companySnapshot:   crawlData.companySnapshot || {},
        trafficSignals:    crawlData.trafficSignals || {},
        techSignals:       crawlData.techSignals || {},
        intentSignals:     crawlData.intentSignals || {},
        structuredDataTypes: crawlData.structuredDataTypes || [],
        robotsTxtPresent:  crawlData.robotsTxtPresent || false,
        sitemapPresent:    crawlData.sitemapPresent || false,
        sitemapUrlCount:   crawlData.sitemapUrlCount || 0,
        crawlCoverage:     crawlData.crawlCoverage || {},
        hasAnalytics:      crawlData.hasAnalytics,
        hasFacebookPixel:  crawlData.hasFacebookPixel,
        hasRetargeting:    crawlData.hasRetargeting,
        // Ad spend is NEVER faked
        estimatedAdSpend:  null,
        adSpend:           null,
        adSpendNote:       crawlData.adSpendNote,
        // Results
        adExamples: [],
        keywordGaps:       finalKeywordGaps,
        messagingAngles:   this._normalizeMessagingAngles(aiInsights?.messagingAngles),
        weaknesses:        this._normalizeEvidenceList(aiInsights?.weaknesses, 'issue'),
        strengths:         this._normalizeEvidenceList(aiInsights?.strengths, 'issue'),
        winbackOpportunities: aiWinbacks,
        winbackUnavailableReason: aiWinbacks.length
          ? null
          : 'No evidence-backed win-back opportunity was found. This analysis has live crawl + SERP snapshot data, but not historical rank-loss data.',
        counterAdTemplates,
        counterAdUnavailableReason: counterAdTemplates.length
          ? null
          : 'Counter-ad templates were not generated because Anthropic did not return evidence-backed creative recommendations.',
        // Data quality flags
        isReal:     true,
        hasAiInsights: !!aiInsights,
        serpProviderStatus: serpEnrichment.providerStatus || null,
        serpFallbackStatus: serpEnrichment.fallbackStatus || null,
        sourceMatrix: this._buildSourceMatrix(crawlData, serpEnrichment, aiInsights),
        evidenceLog: this._buildEvidenceLog(crawlData, mergedKeywords, teamContext),
        dataGaps: this._buildDataGaps(crawlData, serpEnrichment, aiInsights),
        ragContext: this._buildRagContext(teamContext),
        crawledAt:  crawlData.crawledAt,
      };

      return mode === 'overview'
        ? this._buildOverviewResult(baseResult, crawlData, aiInsights)
        : this._buildAttackResult(baseResult, crawlData, aiInsights);
    }

    throw AppError.serviceUnavailable('Could not analyze this competitor because no live crawl data was available.');
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
      trafficSignals: crawlData.trafficSignals || {},
      threatLevel: this._computeThreatLevel(topKeywords, crawlData),
      socialLinks: crawlData.socialLinks || [],
      structuredDataPresent: Boolean(crawlData?.structuredDataTypes?.length),
      pageSpeedScore: null,
      metaTags: {
        title: crawlData.title || null,
        description: crawlData.description || null,
      },
      companySnapshot: crawlData.companySnapshot || {},
      intentSignals: crawlData.intentSignals || {},
      techSignals: crawlData.techSignals || {},
      structuredDataTypes: crawlData.structuredDataTypes || [],
      siteSurfaces: crawlData.siteSurfaces || {},
      contentFootprint: {
        ...(crawlData.contentFootprint || {}),
        headlineCount: crawlData.headings?.length || 0,
        ctaCount: crawlData.ctas?.length || 0,
      },
      technicalSignals: this._buildTechnicalSignals(crawlData),
      contentStrategy: {
        headlineCount: crawlData.headings?.length || 0,
        ctaCount: crawlData.ctas?.length || 0,
        contentTypes: this._detectContentTypes(crawlData),
        topics: topKeywords.slice(0, 8),
      },
      strengths: baseResult.strengths?.length ? baseResult.strengths : this._buildOverviewStrengths(crawlData),
      weaknesses: baseResult.weaknesses?.length ? baseResult.weaknesses : this._buildOverviewWeaknesses(crawlData),
      topKeywords,
      adExamples: [],
      keywordGaps: [],
      winbackOpportunities: [],
    };
  }

  _buildAttackResult(baseResult, crawlData, aiInsights) {
    const researchBasis = baseResult.researchBasis || this._buildResearchBasis(baseResult, crawlData);
    const attackVectors = this._buildAttackVectors(baseResult, crawlData, aiInsights);

    return {
      ...baseResult,
      mode: 'attack',
      researchBasis,
      attackVectors,
      companySnapshot: crawlData.companySnapshot || {},
      trafficSignals: crawlData.trafficSignals || {},
      intentSignals: crawlData.intentSignals || {},
      techSignals: crawlData.techSignals || {},
      technicalSignals: this._buildTechnicalSignals(crawlData),
      contentFootprint: crawlData.contentFootprint || {},
      siteSurfaces: crawlData.siteSurfaces || {},
      structuredDataTypes: crawlData.structuredDataTypes || [],
      socialLinks: crawlData.socialLinks || [],
      weakestPages: (crawlData.headings || []).slice(0, 3).map((h, idx) => ({
        page: h.text,
        reason: idx === 0 ? 'Weak differentiation in headline copy' : 'Likely low CTR due to generic positioning',
      })),
      counterAdTemplates: baseResult.counterAdTemplates || [],
      serpDataNote: baseResult.serpProviderStatus?.degraded
        ? baseResult.serpProviderStatus.message
        : null,
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
      baseResult.topKeywords?.[0]?.position
        ? `Observed organic rank: "${topKeyword}" at position ${baseResult.topKeywords[0].position} via ${baseResult.topKeywords[0].rankSource || 'search data'}.`
        : null,
      crawlData.ctas?.[0] ? `Primary CTA observed: "${crawlData.ctas[0]}".` : null,
      crawlData.headings?.[0]?.text ? `Homepage lead headline: "${crawlData.headings[0].text}".` : null,
      crawlData.techStack?.length ? `Detected stack includes ${crawlData.techStack.slice(0, 3).join(', ')}.` : null,
      crawlData.companySnapshot?.positioning ? `Positioning statement observed: "${crawlData.companySnapshot.positioning}".` : null,
      crawlData.structuredDataTypes?.length ? `Structured data types detected: ${crawlData.structuredDataTypes.slice(0, 4).join(', ')}.` : null,
    ].filter(Boolean);
  }

  _buildAttackVectors(baseResult, crawlData, aiInsights) {
    const topKeywords = (baseResult.topKeywords || []).slice(0, 3);
    const ctas = crawlData.ctas || [];
    const weaknesses = this._normalizeEvidenceList(aiInsights?.weaknesses, 'issue');

    return topKeywords.map((kw, idx) => {
      const keyword = kw.keyword || kw.word;
      const position = kw.position ? `SERP position ${kw.position} via ${kw.rankSource || 'search data'}` : 'no confirmed SERP rank';
      const volume = kw.searchVolume ? `${kw.searchVolume}/mo search demand` : 'search volume unavailable';
      const cta = ctas[idx] || ctas[0] || 'Book a demo';
      const serpFeatures = kw.serpFeatures?.length ? `SERP features: ${kw.serpFeatures.join(', ')}` : 'no visible SERP features';
      return {
        title: `Capture ${keyword} demand`,
        evidence: `Observed keyword "${keyword}" with ${position}; ${volume}; ${serpFeatures}. Their conversion path leans on "${cta}".`,
        move: weaknesses[idx]
          ? `Build a counter-landing page for "${keyword}" and address this exact weakness: ${weaknesses[idx]}`
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

  _buildTechnicalSignals(crawlData) {
    return {
      hasAnalytics: !!crawlData.hasAnalytics,
      hasFacebookPixel: !!crawlData.hasFacebookPixel,
      hasRetargeting: !!crawlData.hasRetargeting,
      robotsTxtPresent: !!crawlData.robotsTxtPresent,
      sitemapPresent: !!crawlData.sitemapPresent,
      sitemapUrlCount: crawlData.sitemapUrlCount || 0,
      structuredDataTypes: crawlData.structuredDataTypes || [],
      techStack: crawlData.techStack || [],
    };
  }

  _buildSourceMatrix(crawlData, serpEnrichment, aiInsights) {
    return [
      {
        source: 'website_crawl',
        status: 'ok',
        detail: `${crawlData.headings?.length || 0} headings, ${crawlData.ctas?.length || 0} CTAs, ${crawlData.internalLinks?.length || 0} internal URLs observed`,
      },
      {
        source: 'traffic_signals',
        status: crawlData.trafficSignals?.summary?.available ? 'ok' : 'unavailable',
        detail: crawlData.trafficSignals?.summary?.available
          ? `Best known popularity rank ${crawlData.trafficSignals.summary.bestKnownGlobalRank} with ${crawlData.trafficSignals.summary.confidence} confidence.`
          : 'No live external popularity rank was available for this run.',
      },
      {
        source: 'intent_signals',
        status: crawlData.intentSignals?.summary?.primaryIntent ? 'ok' : 'unavailable',
        detail: crawlData.intentSignals?.summary?.primaryIntent
          ? `Primary intent ${crawlData.intentSignals.summary.primaryIntent}, funnel stage ${crawlData.intentSignals.summary.funnelStage}.`
          : 'Intent signals could not be derived from the live crawl.',
      },
      {
        source: 'valueserp',
        status: serpEnrichment.providerStatus?.status || 'unavailable',
        detail: serpEnrichment.providerStatus?.message || 'ValueSERP was not used for this run',
      },
      {
        source: 'organic_fallback',
        status: serpEnrichment.fallbackStatus?.status || 'unavailable',
        detail: serpEnrichment.fallbackStatus?.message || 'No fallback organic search result was available',
      },
      {
        source: 'rag_team_memory',
        status: 'ok',
        detail: 'Team memory was retrieved from tracked keywords, prior research, and owned content.',
      },
      {
        source: 'anthropic_reasoning',
        status: aiInsights ? 'ok' : 'unavailable',
        detail: aiInsights
          ? 'Anthropic generated evidence-backed strategic synthesis from the observed dossier.'
          : 'Anthropic did not return strategic synthesis for this run.',
      },
    ];
  }

  _buildEvidenceLog(crawlData, mergedKeywords, teamContext) {
    const entries = [];

    if (crawlData.companySnapshot?.positioning) {
      entries.push({ type: 'positioning', detail: crawlData.companySnapshot.positioning });
    }
    if (crawlData.intentSignals?.summary?.primaryIntent) {
      entries.push({
        type: 'intent',
        detail: `Primary buyer intent is ${crawlData.intentSignals.summary.primaryIntent} at ${crawlData.intentSignals.summary.funnelStage}-funnel.`,
      });
    }
    if (crawlData.trafficSignals?.summary?.bestKnownGlobalRank) {
      entries.push({
        type: 'traffic',
        detail: `Observed external popularity rank ${crawlData.trafficSignals.summary.bestKnownGlobalRank} (${crawlData.trafficSignals.summary.confidence} confidence).`,
      });
    }
    if (crawlData.heroHeading) {
      entries.push({ type: 'hero', detail: `Hero heading: "${crawlData.heroHeading}"` });
    }
    if (mergedKeywords[0]?.keyword) {
      entries.push({
        type: 'keyword',
        detail: `Observed keyword "${mergedKeywords[0].keyword}"${mergedKeywords[0].position ? ` ranking at #${mergedKeywords[0].position}` : ''}${mergedKeywords[0].rankSource ? ` via ${mergedKeywords[0].rankSource}` : ''}.`,
      });
    }
    if (crawlData.ctas?.[0]) {
      entries.push({ type: 'cta', detail: `Primary CTA observed: "${crawlData.ctas[0]}".` });
    }
    if (crawlData.siteSurfaces?.pricing > 0 || crawlData.siteSurfaces?.blog > 0) {
      entries.push({
        type: 'site_surface',
        detail: `Observed site surfaces: pricing=${crawlData.siteSurfaces?.pricing || 0}, blog=${crawlData.siteSurfaces?.blog || 0}, docs=${crawlData.siteSurfaces?.docs || 0}, features=${crawlData.siteSurfaces?.features || 0}.`,
      });
    }
    if (teamContext?.trackedKeywordOverlap?.length) {
      entries.push({
        type: 'rag_overlap',
        detail: `Team memory shows overlap on ${teamContext.trackedKeywordOverlap.slice(0, 3).map((item) => item.keyword).join(', ')}.`,
      });
    }

    return entries.slice(0, 8);
  }

  _buildDataGaps(crawlData, serpEnrichment, aiInsights) {
    const gaps = [];
    if (serpEnrichment.providerStatus?.degraded) gaps.push(serpEnrichment.providerStatus.message);
    if (serpEnrichment.fallbackStatus?.degraded) gaps.push(serpEnrichment.fallbackStatus.message);
    if (!crawlData.trafficSignals?.summary?.available) gaps.push('External traffic/popularity rank was unavailable, so reach is inferred only from on-site evidence.');
    if (!crawlData.sitemapPresent) gaps.push('Sitemap could not be confirmed, so content coverage may be incomplete.');
    if (!crawlData.robotsTxtPresent) gaps.push('robots.txt could not be confirmed from the public site.');
    if (!aiInsights) gaps.push('Anthropic strategic synthesis was unavailable for this run.');
    gaps.push(crawlData.adSpendNote || 'Paid ad spend still requires ad-network transparency or paid competitive-intel APIs.');
    return [...new Set(gaps)].slice(0, 6);
  }

  _buildRagContext(teamContext) {
    return {
      trackedKeywordOverlap: teamContext?.trackedKeywordOverlap || [],
      topOwnedKeywords: teamContext?.topOwnedKeywords || [],
      priorResearch: teamContext?.priorResearch || [],
      recentBriefs: teamContext?.recentBriefs || [],
      recentAudits: teamContext?.recentAudits || [],
    };
  }

  _mergeKeywordEvidence(crawlKeywords, enrichedKeywords) {
    const enrichedMap = new Map((enrichedKeywords || []).map((item) => [item.keyword, item]));
    return (crawlKeywords || []).slice(0, 10).map((item) => {
      const keyword = String(item.word || item.keyword || '').trim().toLowerCase();
      const enriched = enrichedMap.get(keyword) || {};
      return {
        keyword,
        frequency: item.frequency ?? null,
        position: enriched.position ?? null,
        searchVolume: enriched.searchVolume ?? null,
        rankSource: enriched.rankSource ?? null,
        serpFeatures: enriched.serpFeatures ?? [],
        relatedQuestions: enriched.relatedQuestions ?? [],
        relatedSearches: enriched.relatedSearches ?? [],
        totalResults: enriched.totalResults ?? null,
      };
    }).filter((item) => item.keyword);
  }

  _buildKeywordGaps(topKeywords, aiInsights) {
    const aiGapMap = new Map(
      (Array.isArray(aiInsights?.keywordGaps) ? aiInsights.keywordGaps : [])
        .map((gap) => [String(gap.keyword || '').trim().toLowerCase(), gap])
        .filter(([keyword]) => keyword)
    );

    return (topKeywords || []).slice(0, 5).map((keyword) => {
      const aiGap = aiGapMap.get(keyword.keyword) || {};
      const evidence = [
        keyword.position ? `competitor ranks #${keyword.position}` : 'competitor rank unconfirmed',
        keyword.serpFeatures?.length ? `SERP features: ${keyword.serpFeatures.join(', ')}` : null,
      ].filter(Boolean).join('; ');

      return {
        keyword: keyword.keyword,
        theirRank: keyword.position ?? null,
        theirRankSource: keyword.rankSource ?? null,
        yourRank: null,
        volume: keyword.searchVolume ?? null,
        opportunity: aiGap.move || aiGap.evidence || evidence || null,
        difficulty: aiGap.difficulty || null,
        source: aiGap.move || aiGap.evidence ? 'anthropic' : 'crawl',
      };
    });
  }

  _normalizeMessagingAngles(items) {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => typeof item === 'string' ? item : item?.angle)
      .filter(Boolean)
      .slice(0, 5);
  }

  _normalizeEvidenceList(items, key) {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (typeof item === 'string') return item;
        const label = item?.[key];
        const evidence = item?.evidence ? ` (${item.evidence})` : '';
        return label ? `${label}${evidence}` : null;
      })
      .filter(Boolean)
      .slice(0, 5);
  }

  _normalizeWinbackOpportunities(items, observedKeywords = []) {
    if (!Array.isArray(items)) return [];
    const keywordSet = new Set(observedKeywords.map((item) => String(item || '').trim().toLowerCase()).filter(Boolean));
    return items
      .map((item) => {
        if (!item?.title || !item?.evidence || !item?.action) return null;
        const targetKeyword = String(item.targetKeyword || '').trim().toLowerCase();
        const evidence = String(item.evidence || '').toLowerCase();
        const matchedKeyword = targetKeyword && keywordSet.has(targetKeyword)
          ? targetKeyword
          : [...keywordSet].find((keyword) => evidence.includes(keyword));
        if (!matchedKeyword) return null;
        return {
          angle: 'Evidence-backed win-back',
          suggestedHeadline: item.title,
          reason: item.evidence,
          action: item.action,
          targetKeyword: matchedKeyword,
          source: 'anthropic',
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  }

  _normalizeCounterAds(items) {
    if (!Array.isArray(items)) return [];
    return items
      .map((item) => {
        if (!item?.headline || !item?.body) return null;
        return {
          angle: item.angle || 'Counter-positioning',
          headline: String(item.headline).slice(0, 30),
          description: String(item.body).slice(0, 90),
          evidence: item.evidence || null,
          cta: item.cta || null,
          targetAudience: item.targetAudience || null,
        };
      })
      .filter(Boolean)
      .slice(0, 3);
  }
}

module.exports = new CompetitorHijackService();
