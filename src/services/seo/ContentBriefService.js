'use strict';

const natural  = require('natural');
const prisma   = require('../../config/prisma');
const logger   = require('../../config/logger');
const AppError = require('../../common/AppError');
const config   = require('../../config');
const gemini      = require('../ai/GeminiService');
const ollama      = require('../ai/OllamaService');
const huggingface = require('../ai/HuggingFaceService');
const anthropic   = require('../ai/AnthropicService');
const teamContextService = require('../ai/TeamContextService');
const serpIntelligence = require('./SerpIntelligenceService');

const TfIdf     = natural.TfIdf;
const tokenizer = new natural.WordTokenizer();
const stopwords = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with','by',
  'is','are','was','were','be','been','being','have','has','had','do','does',
  'did','will','would','could','should','may','might','shall','can',
  'this','that','these','those','it','its','i','we','you','he','she','they',
  'not','from','up','out','as','into','if','then','so','than',
]);

const SEARCH_INTENTS = ['informational', 'commercial', 'transactional', 'navigational'];

class ContentBriefService {
  /**
   * Generate a content brief for a target keyword.
   * Uses OpenAI gpt-4o-mini if OPENAI_API_KEY is set; otherwise falls back to
   * the deterministic TF-IDF algorithm.
   *
   * @param {string} teamId
   * @param {string} targetKeyword
   * @returns {object} saved brief
   */
  async generate(teamId, targetKeyword) {
    if (!targetKeyword?.trim()) throw AppError.badRequest('targetKeyword is required');

    const serpContext = await this._buildSerpContext(targetKeyword);
    const teamContext = await teamContextService.getKeywordContext(teamId, targetKeyword);
    let aiResult = null;

    // 1. Anthropic Claude (preferred because current VPS env is working here)
    if (!aiResult && anthropic.isAvailable) {
      aiResult = await this._generateWithAnthropic(teamId, targetKeyword, serpContext, teamContext);
    }

    if (aiResult) {
      return this._saveBrief(teamId, targetKeyword, aiResult, serpContext);
    }

    // Fallback: deterministic SERP-backed brief, not generic model output.
    return this._generateFallback(teamId, targetKeyword, serpContext);
  }

  /**
   * Generate brief via HuggingFace Inference API (free key, Mistral-7B).
   */
  async _generateWithHuggingFace(teamId, targetKeyword) {
    try {
      const relatedKeywords = await prisma.keyword.findMany({
        where:  { teamId },
        select: { keyword: true },
        take:   12,
      });
      const result = await huggingface.generateContentBrief({
        keyword:         targetKeyword,
        relatedKeywords: relatedKeywords.map(k => k.keyword),
      });
      if (!result || !result.title || !Array.isArray(result.outline)) return null;
      if (!SEARCH_INTENTS.includes(result.searchIntent)) result.searchIntent = 'informational';
      return { ...result, _source: 'huggingface' };
    } catch (err) {
      logger.warn('ContentBriefService: HuggingFace generation failed', { err: err.message });
      return null;
    }
  }

  /**
   * Call OpenAI gpt-4o-mini and parse JSON response.
   * Returns null on any error so caller falls back gracefully.
   */
  async _generateWithAI(keyword) {
    try {
      const { default: OpenAI } = await import('openai');
      const openai = new OpenAI({ apiKey: config.openaiApiKey });

      const prompt = `You are an expert SEO content strategist. Generate a detailed content brief for the keyword: "${keyword}".
Return ONLY a valid JSON object with these exact fields:
{
  "title": "SEO-optimized H1 title",
  "metaDescription": "150-160 character meta description",
  "targetWordCount": 1500,
  "outline": [{ "heading": "Section heading", "subpoints": ["subpoint 1", "subpoint 2"] }],
  "relatedKeywords": ["keyword1", "keyword2", "keyword3"],
  "searchIntent": "informational",
  "competitorAngle": "Brief note on what competitors cover and how to differentiate",
  "callToAction": "Primary CTA suggestion for this content"
}
searchIntent must be one of: informational, commercial, transactional, navigational.
Return ONLY the JSON object, no markdown, no extra text.`;

      const res = await openai.chat.completions.create({
        model:       'gpt-4o-mini',
        messages:    [{ role: 'user', content: prompt }],
        temperature: 0.7,
        max_tokens:  1500,
      });

      const raw = res.choices[0]?.message?.content?.trim() ?? '';
      // Strip accidental markdown fences
      const jsonStr = raw.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '');
      const parsed  = JSON.parse(jsonStr);

      // Validate key fields
      if (!parsed.title || !Array.isArray(parsed.outline)) throw new Error('Invalid AI response shape');
      if (!SEARCH_INTENTS.includes(parsed.searchIntent)) parsed.searchIntent = 'informational';

      return parsed;
    } catch (err) {
      logger.warn('ContentBriefService: OpenAI generation failed — using fallback', { err: err.message });
      return null;
    }
  }

  /**
   * Generate brief via Ollama (local, free, highest priority).
   */
  async _generateWithOllama(teamId, targetKeyword, serpContext) {
    try {
      const relatedKeywords = await prisma.keyword.findMany({
        where:  { teamId },
        select: { keyword: true },
        take:   15,
      });
      const result = await ollama.generateContentBrief({
        keyword:         targetKeyword,
        relatedKeywords: [...relatedKeywords.map(k => k.keyword), ...(serpContext.relatedSearches || [])],
      });
      if (!result || !result.title || !Array.isArray(result.outline)) return null;
      if (!SEARCH_INTENTS.includes(result.searchIntent)) result.searchIntent = 'informational';
      return { ...result, _source: 'ollama' };
    } catch (err) {
      logger.warn('ContentBriefService: Ollama generation failed', { err: err.message });
      return null;
    }
  }

  /**
   * Generate brief via Gemini (free tier fallback when OpenAI is absent).
   */
  async _generateWithGemini(teamId, targetKeyword, serpContext, teamContext) {
    try {
      const result = await this._generateSerpBackedBrief(
        targetKeyword,
        await this._collectRelatedKeywords(teamId, serpContext),
        serpContext,
        'gemini',
        teamContext
      );
      if (!result || !result.title || !Array.isArray(result.outline)) return null;
      if (!SEARCH_INTENTS.includes(result.searchIntent)) result.searchIntent = 'informational';
      return result;
    } catch (err) {
      logger.warn('ContentBriefService: Gemini generation failed — using fallback', { err: err.message });
      return null;
    }
  }

  /**
   * Generate brief via Anthropic Claude (reliable paid-key fallback).
   */
  async _generateWithAnthropic(teamId, targetKeyword, serpContext, teamContext) {
    try {
      const result = await this._generateSerpBackedBrief(
        targetKeyword,
        await this._collectRelatedKeywords(teamId, serpContext),
        serpContext,
        'anthropic',
        teamContext
      );
      if (!result || !result.title || !Array.isArray(result.outline)) return null;
      if (!SEARCH_INTENTS.includes(result.searchIntent)) result.searchIntent = 'informational';
      return { ...result, _source: 'anthropic' };
    } catch (err) {
      logger.warn('ContentBriefService: Anthropic generation failed', { err: err.message });
      return null;
    }
  }

  /**
   * Deterministic fallback using TF-IDF + team keyword pool.
   */
  async _generateFallback(teamId, targetKeyword, serpContext = {}) {
    const allKeywords     = await prisma.keyword.findMany({ where: { teamId } });
    const relatedKeywords = this._clusterRelated(targetKeyword, allKeywords);
    const semanticTerms   = this._extractSemanticTerms(targetKeyword, relatedKeywords);
    const avgDifficulty = relatedKeywords.length
      ? relatedKeywords.reduce((s, k) => s + (k.difficulty || 50), 0) / relatedKeywords.length
      : 50;
    const relatedKeywordNames = this._dedupeStrings([
      ...relatedKeywords.map((k) => k.keyword),
      ...(serpContext.relatedSearches || []),
    ]).slice(0, 20);
    const topResults = serpContext.topResults || [];
    const outline = this._buildDeterministicSerpOutline(targetKeyword, serpContext, semanticTerms);
    const entities = this._extractEntities(topResults, targetKeyword);
    const competitorHeadlines = topResults.slice(0, 3).map((result) => ({
      title: result.title,
      url: result.link,
      headings: (result.headings || []).slice(0, 4),
    }));

    const fallbackBrief = {
      title: this._generateTitle(targetKeyword),
      metaDescription: this._buildMetaDescription(targetKeyword, serpContext),
      targetWordCount: this._estimateSerpWordCount(avgDifficulty, topResults),
      searchIntent: this._inferIntentFromSerp(targetKeyword, serpContext),
      outline,
      relatedKeywords: relatedKeywordNames,
      competitorAngle: this._buildCompetitorAngle(topResults, targetKeyword),
      callToAction: `Use this brief to publish a stronger ${targetKeyword} page than the current top-ranking results.`,
      titleOptions: this._buildSerpTitleOptions(targetKeyword, serpContext),
      peopleAlsoAsk: (serpContext.peopleAlsoAsk || []).slice(0, 6),
      uniqueAngle: this._buildUniqueAngle(targetKeyword, serpContext),
      entities,
      competitorHeadlines,
      semanticTerms,
      relatedKeywordsEnriched: relatedKeywords.slice(0, 10),
      _source: 'fallback',
    };

    return this._saveBrief(teamId, targetKeyword, fallbackBrief, serpContext);
  }

  async _buildSerpContext(targetKeyword) {
    const { snapshot, topResults } = await serpIntelligence.getTopResultDetails(targetKeyword, 5);
    if (!snapshot) {
      logger.warn('ContentBriefService: SERP data unavailable — brief will use AI-only context');
    }
    return {
      searchVolume: null,
      difficulty: null,
      topResults,
      peopleAlsoAsk: snapshot?.relatedQuestions || [],
      relatedSearches: snapshot?.relatedSearches || [],
      serpFeatures: snapshot?.serpFeatures || [],
      totalResults: snapshot?.totalResults || null,
    };
  }

  async _generateSerpBackedBrief(targetKeyword, relatedKeywords, serpContext, provider, teamContext) {
    const prompt = `You are a content strategist creating a brief for a writer.

TARGET KEYWORD: "${targetKeyword}"
SEARCH VOLUME: ${serpContext.searchVolume ?? 'null'}/month
KEYWORD DIFFICULTY: ${serpContext.difficulty ?? 'null'}/100

TOP 5 RANKING ARTICLES:
${(serpContext.topResults || []).map((r, i) => `${i + 1}. "${r.title}" — ${r.link}
   Word count: ~${r.wordCount || 0}
   Headings: ${(r.headings || []).join(' | ') || 'n/a'}`).join('\n')}

PEOPLE ALSO ASK:
${(serpContext.peopleAlsoAsk || []).join('\n') || 'n/a'}

RELATED SEARCHES:
${(serpContext.relatedSearches || []).join(', ') || relatedKeywords.join(', ')}

SERP FEATURES PRESENT:
${(serpContext.serpFeatures || []).join(', ') || 'none'}

${teamContextService.formatKeywordContext(teamContext)}

Generate a JSON object with these exact fields:
{
  "title": "SEO-optimized H1 title",
  "metaDescription": "150-160 char meta description",
  "targetWordCount": 1800,
  "searchIntent": "informational",
  "outline": [{"heading":"...","subpoints":["..."]}],
  "relatedKeywords": ["..."],
  "competitorAngle": "how to beat the ranking pages",
  "callToAction": "primary CTA suggestion",
  "titleOptions": ["...", "...", "..."],
  "peopleAlsoAsk": ["...", "..."],
  "uniqueAngle": "what top results are missing",
  "entities": ["entity 1", "entity 2"],
  "competitorHeadlines": [{"title":"...", "url":"...", "headings":["...", "..."]}]
}

Rules:
- Use the competitor headings and PAA questions directly in the planning.
- Avoid generic sections like "What is ${targetKeyword}?" or "Beginner tips" unless the SERP clearly demands them.
- Build the outline from the actual ranking pages above. At least 4 outline sections must clearly map to real competitor headings or question clusters.
- Make the title options meaningfully different from each other: one practical, one comparison-driven, one decision-making or commercial.
- Related keywords must be semantically relevant to the SERP context above, not generic SEO filler.
- Unique angle must name a specific coverage gap from the ranking pages above.
- Respect the team memory above so the brief does not duplicate tracked keywords, prior briefs, or existing strategic angles unless there is a clear reason.
- Return valid JSON only.`;

    let parsed = null;
    if (provider === 'anthropic') {
      parsed = await anthropic.generateJSON(prompt, {
        maxTokens: 1400,
        temperature: 0.15,
        cacheKey: ['content-brief', targetKeyword, teamContextService.formatKeywordContext(teamContext)].join('|'),
        cacheTtlSeconds: 12 * 60 * 60,
      });
    }
    if (provider === 'gemini') {
      const raw = await gemini.generate(prompt, { maxTokens: 1400, temperature: 0.2 });
      parsed = anthropic.parseJSON(raw);
    }

    if (!parsed || !parsed.title || !Array.isArray(parsed.outline)) return null;
    return this._normalizeBriefResult(parsed, targetKeyword, relatedKeywords, serpContext, provider);
  }

  async _collectRelatedKeywords(teamId, serpContext) {
    const teamKeywords = await prisma.keyword.findMany({
      where: { teamId },
      select: { keyword: true },
      take: 20,
    });
    return this._dedupeStrings([
      ...teamKeywords.map((entry) => entry.keyword),
      ...(serpContext.relatedSearches || []),
    ]).slice(0, 20);
  }

  _normalizeBriefResult(parsed, targetKeyword, relatedKeywords, serpContext, provider) {
    const topResults = serpContext.topResults || [];
    const normalized = {
      title: parsed.title || this._generateTitle(targetKeyword),
      metaDescription: parsed.metaDescription || this._buildMetaDescription(targetKeyword, serpContext),
      targetWordCount: Number(parsed.targetWordCount) || this._estimateSerpWordCount(50, topResults),
      searchIntent: SEARCH_INTENTS.includes(parsed.searchIntent) ? parsed.searchIntent : this._inferIntentFromSerp(targetKeyword, serpContext),
      outline: this._normalizeOutline(parsed.outline, targetKeyword, serpContext),
      relatedKeywords: this._dedupeStrings([
        ...(Array.isArray(parsed.relatedKeywords) ? parsed.relatedKeywords : []),
        ...relatedKeywords,
      ]).slice(0, 20),
      competitorAngle: parsed.competitorAngle || this._buildCompetitorAngle(topResults, targetKeyword),
      callToAction: parsed.callToAction || `Use this brief to create the strongest ${targetKeyword} page in your category.`,
      titleOptions: this._dedupeStrings([
        ...(Array.isArray(parsed.titleOptions) ? parsed.titleOptions : []),
        ...this._buildSerpTitleOptions(targetKeyword, serpContext),
      ]).slice(0, 5),
      peopleAlsoAsk: this._dedupeStrings([
        ...(Array.isArray(parsed.peopleAlsoAsk) ? parsed.peopleAlsoAsk : []),
        ...(serpContext.peopleAlsoAsk || []),
      ]).slice(0, 6),
      uniqueAngle: parsed.uniqueAngle || this._buildUniqueAngle(targetKeyword, serpContext),
      entities: this._dedupeStrings([
        ...(Array.isArray(parsed.entities) ? parsed.entities : []),
        ...this._extractEntities(topResults, targetKeyword),
      ]).slice(0, 12),
      competitorHeadlines: this._normalizeCompetitorHeadlines(parsed.competitorHeadlines, topResults),
      _source: provider,
    };
    return normalized;
  }

  async _saveBrief(teamId, targetKeyword, briefData, serpContext) {
    let brief;
    try {
      brief = await prisma.contentBrief.create({
        data: {
          teamId,
          targetKeyword,
          title: briefData.title,
          metaDescription: briefData.metaDescription || null,
          targetWordCount: briefData.targetWordCount || null,
          searchIntent: briefData.searchIntent || null,
          outline: briefData.outline || [],
          relatedKeywords: briefData.relatedKeywords || [],
          peopleAlsoAsk: briefData.peopleAlsoAsk || [],
          titleOptions: briefData.titleOptions || [],
          competitorAngle: briefData.competitorAngle || null,
          uniqueAngle: briefData.uniqueAngle || null,
          callToAction: briefData.callToAction || null,
          entities: briefData.entities || [],
          competitorHeadlines: briefData.competitorHeadlines || [],
          source: briefData._source || 'fallback',
          status: 'draft',
        },
      });
    } catch (err) {
      if (!this._isLegacySchemaError(err)) throw err;

      logger.warn('ContentBriefService: falling back to legacy content_briefs schema', { err: err.message });
      brief = await prisma.contentBrief.create({
        data: {
          teamId,
          targetKeyword,
          title: briefData.title,
          outline: briefData.outline || [],
          relatedKeywords: briefData.relatedKeywords || [],
          status: 'draft',
        },
      });
    }

    return {
      ...brief,
      metaDescription: brief.metaDescription ?? briefData.metaDescription ?? null,
      targetWordCount: brief.targetWordCount ?? briefData.targetWordCount ?? null,
      searchIntent: brief.searchIntent ?? briefData.searchIntent ?? null,
      peopleAlsoAsk: brief.peopleAlsoAsk ?? briefData.peopleAlsoAsk ?? [],
      titleOptions: brief.titleOptions ?? briefData.titleOptions ?? [],
      competitorAngle: brief.competitorAngle ?? briefData.competitorAngle ?? null,
      uniqueAngle: brief.uniqueAngle ?? briefData.uniqueAngle ?? null,
      callToAction: brief.callToAction ?? briefData.callToAction ?? null,
      entities: brief.entities ?? briefData.entities ?? [],
      competitorHeadlines: brief.competitorHeadlines ?? briefData.competitorHeadlines ?? [],
      source: brief.source ?? briefData._source ?? 'fallback',
      serpContext,
      semanticTerms: briefData.semanticTerms || [],
      relatedKeywordsEnriched: briefData.relatedKeywordsEnriched || [],
      _source: briefData._source || 'fallback',
    };
  }

  _buildTitleOptions(keyword) {
    const cap = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    return [
      `${cap}: The Practical Guide`,
      `How to Win With ${cap}`,
      `${cap} Strategy: What Actually Works`,
    ];
  }

  _buildSerpTitleOptions(keyword, serpContext = {}) {
    const topResults = serpContext.topResults || [];
    const noun = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    const firstCompetitor = topResults[0]?.title || `${noun} guide`;
    return [
      `${noun}: The Practical Playbook for ${new Date().getFullYear()}`,
      `${noun} Compared: What the Top Results Miss`,
      `How to Choose the Right ${noun} Strategy`,
      `Before You Invest in ${noun}, Read This`,
      `What Actually Works for ${noun} Right Now`,
      `A Better ${noun} Guide Than "${firstCompetitor}"`,
    ];
  }

  _normalizeOutline(outline, keyword, serpContext) {
    if (!Array.isArray(outline) || !outline.length) {
      return this._buildDeterministicSerpOutline(keyword, serpContext, []);
    }

    return outline
      .filter((section) => section && typeof section.heading === 'string')
      .map((section) => ({
        heading: section.heading.trim(),
        subpoints: Array.isArray(section.subpoints)
          ? section.subpoints.map((point) => String(point).trim()).filter(Boolean).slice(0, 6)
          : [],
      }))
      .filter((section) => section.heading)
      .slice(0, 10);
  }

  _normalizeCompetitorHeadlines(raw, topResults = []) {
    if (Array.isArray(raw) && raw.length) {
      return raw.slice(0, 5).map((item) => ({
        title: item?.title || '',
        url: item?.url || item?.link || '',
        headings: Array.isArray(item?.headings) ? item.headings.slice(0, 5) : [],
      })).filter((item) => item.title);
    }

    return topResults.slice(0, 3).map((result) => ({
      title: result.title,
      url: result.link,
      headings: (result.headings || []).slice(0, 5),
    }));
  }

  _buildDeterministicSerpOutline(keyword, serpContext = {}, semanticTerms = []) {
    const topResults = serpContext.topResults || [];
    const sections = [];
    const seen = new Set();

    for (const result of topResults) {
      for (const heading of result.headings || []) {
        const normalized = heading.trim();
        const lower = normalized.toLowerCase();
        if (!normalized || normalized.length < 12) continue;
        if (lower === keyword.toLowerCase()) continue;
        if (lower.startsWith('what is ') || lower.startsWith('what are ')) continue;
        if (seen.has(lower)) continue;
        seen.add(lower);
        sections.push({
          heading: normalized,
          subpoints: this._deriveSubpointsFromHeading(normalized, keyword, result),
        });
        if (sections.length >= 6) break;
      }
      if (sections.length >= 6) break;
    }

    if (serpContext.peopleAlsoAsk?.length) {
      sections.push({
        heading: `Questions buyers ask about ${keyword}`,
        subpoints: serpContext.peopleAlsoAsk.slice(0, 4),
      });
    }

    if (!sections.length) {
      return this._generateOutline(keyword, semanticTerms);
    }

    return sections.slice(0, 8);
  }

  _deriveSubpointsFromHeading(heading, keyword, result = {}) {
    const snippet = result.snippet || '';
    const candidates = [
      snippet,
      `Explain how ${heading.toLowerCase()} affects ${keyword}.`,
      `Add examples, benchmarks, or screenshots to make "${heading}" more actionable.`,
      `Show what the current ranking pages cover and where this section can go deeper.`,
    ];
    return this._dedupeStrings(candidates).slice(0, 4);
  }

  _inferIntentFromSerp(keyword, serpContext = {}) {
    const haystack = [
      keyword,
      ...(serpContext.relatedSearches || []),
      ...((serpContext.topResults || []).map((result) => result.title || '')),
    ].join(' ').toLowerCase();

    if (/(buy|pricing|price|software|tool|service|agency|best|top|vs|compare|review)/.test(haystack)) return 'commercial';
    if (/(sign in|login|homepage|official|docs|documentation|youtube|reddit|linkedin)/.test(haystack)) return 'navigational';
    if (/(template|download|hire|book|demo|get started|trial)/.test(haystack)) return 'transactional';
    return 'informational';
  }

  _estimateSerpWordCount(avgDifficulty, topResults = []) {
    const wordCounts = topResults.map((result) => Number(result.wordCount) || 0).filter(Boolean);
    if (wordCounts.length) {
      const average = Math.round(wordCounts.reduce((sum, count) => sum + count, 0) / wordCounts.length);
      return Math.max(1200, Math.min(4000, average + 150));
    }
    return this._estimateWordCount(avgDifficulty);
  }

  _buildMetaDescription(keyword, serpContext = {}) {
    const firstPaa = serpContext.peopleAlsoAsk?.[0];
    if (firstPaa) {
      return `A practical guide to ${keyword} with competitor insights, key questions, and the angles needed to outperform current top-ranking pages.`;
    }
    return `A practical guide to ${keyword} built from real SERP research, competitor headings, and the questions searchers are already asking.`;
  }

  _buildCompetitorAngle(topResults = [], keyword) {
    if (!topResults.length) {
      return `Publish a stronger ${keyword} page by adding more specificity, examples, and decision-making guidance than the existing ranking content.`;
    }
    const titles = topResults.slice(0, 3).map((result) => `"${result.title}"`).join(', ');
    return `Current leaders like ${titles} cover the topic broadly. Beat them by matching their core sections, tightening the structure, and adding clearer examples, comparisons, and proof points.`;
  }

  _buildUniqueAngle(keyword, serpContext = {}) {
    const headings = (serpContext.topResults || []).flatMap((result) => result.headings || []).map((heading) => heading.toLowerCase());
    if (!headings.some((heading) => heading.includes('mistake'))) {
      return `Add a "common ${keyword} mistakes" section with concrete examples from the market.`;
    }
    if (!headings.some((heading) => heading.includes('compare') || heading.includes('vs'))) {
      return `Add a comparison section that helps readers evaluate ${keyword} options instead of just explaining the concept.`;
    }
    return `Add proof-driven examples, benchmarks, and screenshots that the current top pages do not show clearly.`;
  }

  _extractEntities(topResults = [], keyword) {
    const candidates = [];
    for (const result of topResults) {
      if (result.domain) candidates.push(result.domain);
      for (const heading of result.headings || []) {
        const matches = String(heading).match(/\b[A-Z][a-zA-Z0-9+-]{2,}\b/g) || [];
        candidates.push(...matches);
      }
    }
    return this._dedupeStrings(candidates)
      .filter((term) => term.toLowerCase() !== keyword.toLowerCase())
      .slice(0, 12);
  }

  _dedupeStrings(values = []) {
    const seen = new Set();
    const output = [];
    for (const value of values) {
      const text = String(value || '').trim();
      const key = text.toLowerCase();
      if (!text || seen.has(key)) continue;
      seen.add(key);
      output.push(text);
    }
    return output;
  }

  _clusterRelated(target, keywords) {
    const targetTokens = new Set(tokenizer.tokenize(target.toLowerCase()).filter((t) => !stopwords.has(t)));
    return keywords.filter((kw) => {
      const tokens = new Set(tokenizer.tokenize(kw.keyword.toLowerCase()).filter((t) => !stopwords.has(t)));
      const intersection = [...targetTokens].filter((t) => tokens.has(t)).length;
      const union = new Set([...targetTokens, ...tokens]).size;
      return union > 0 && intersection / union >= 0.2;
    });
  }

  _extractSemanticTerms(targetKeyword, relatedKeywords) {
    const tfidf  = new TfIdf();
    const corpus = [targetKeyword, ...relatedKeywords.map((k) => k.keyword)];
    corpus.forEach((doc) => tfidf.addDocument(doc));
    const terms = {};
    tfidf.listTerms(0).slice(0, 20).forEach(({ term, tfidf: score }) => {
      if (!stopwords.has(term) && term.length > 2) terms[term] = parseFloat(score.toFixed(3));
    });
    return Object.entries(terms).sort((a, b) => b[1] - a[1]).slice(0, 15).map(([term, score]) => ({ term, score }));
  }

  _estimateWordCount(avgDifficulty) {
    if (avgDifficulty < 30) return 800;
    if (avgDifficulty < 50) return 1200;
    if (avgDifficulty < 70) return 1800;
    return 2500;
  }

  _generateTitle(keyword) {
    const yr = new Date().getFullYear();
    const kCap = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    const templates = [
      `${kCap}: The ${yr} Practical Guide (With Real Examples)`,
      `How to Get Results With ${kCap} — Actionable ${yr} Playbook`,
      `${kCap} Explained: What Actually Works in ${yr}`,
      `The ${yr} ${kCap} Handbook — From Basics to Advanced`,
    ];
    // deterministic pick based on keyword hash so it doesn't change on re-render
    const idx = keyword.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % templates.length;
    return templates[idx];
  }

  _generateOutline(keyword, semanticTerms) {
    const yr = new Date().getFullYear();
    const kCap = keyword.charAt(0).toUpperCase() + keyword.slice(1);
    const topTerms = semanticTerms.slice(0, 4).map((t) => t.term);
    return [
      {
        heading:   `The ${yr} State of ${kCap}: Key Trends You Can't Ignore`,
        subpoints: [`Why ${keyword} is more competitive than ever`, 'What top performers do differently', 'Benchmarks and industry data'],
      },
      {
        heading:   `${kCap} Fundamentals — What You Must Get Right First`,
        subpoints: ['Core mechanics and how they work', 'Common beginner mistakes that kill results', 'The 80/20 rule: where to focus your effort'],
      },
      ...(topTerms.length >= 1 ? [{
        heading:   `${kCap} + ${topTerms[0].charAt(0).toUpperCase() + topTerms[0].slice(1)}: The Winning Combination`,
        subpoints: ['Why this combination outperforms alternatives', 'Step-by-step implementation', 'Real-world results and case studies'],
      }] : []),
      ...(topTerms.length >= 2 ? [{
        heading:   `Advanced ${kCap}: ${topTerms[1].charAt(0).toUpperCase() + topTerms[1].slice(1)} Strategies That Scale`,
        subpoints: ['Tactics used by top 10% performers', 'Tools and automation to multiply output', 'How to measure and optimize continuously'],
      }] : []),
      {
        heading:   `${kCap} Toolkit: The Best Tools, Frameworks, and Resources (${yr})`,
        subpoints: ['Free vs. paid options compared', 'What the data says about ROI', 'Setup guide for each recommendation'],
      },
      {
        heading:   `Measuring ${kCap} Success: Metrics That Actually Matter`,
        subpoints: ['KPIs worth tracking (and ones to ignore)', 'Dashboard setup and reporting cadence', 'When to pivot vs. double down'],
      },
      {
        heading:   `Common ${kCap} Mistakes and How to Fix Them Fast`,
        subpoints: ['Top 5 errors that waste budget and time', 'Diagnostic checklist', 'Quick wins to implement today'],
      },
    ];
  }

  async getBriefs(teamId, { page = 1, limit = 10 } = {}) {
    const skip = (page - 1) * limit;
    let items;
    let total;

    try {
      [items, total] = await Promise.all([
        prisma.contentBrief.findMany({ where: { teamId }, orderBy: { createdAt: 'desc' }, skip, take: limit }),
        prisma.contentBrief.count({ where: { teamId } }),
      ]);
    } catch (err) {
      if (!this._isLegacySchemaError(err)) throw err;

      logger.warn('ContentBriefService: reading briefs with legacy schema fallback', { err: err.message });
      [items, total] = await Promise.all([
        prisma.contentBrief.findMany({
          where: { teamId },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            teamId: true,
            targetKeyword: true,
            title: true,
            outline: true,
            relatedKeywords: true,
            status: true,
            createdAt: true,
          },
        }),
        prisma.contentBrief.count({ where: { teamId } }),
      ]);
    }

    const normalizedItems = items.map((item) => ({
      ...item,
      metaDescription: item.metaDescription ?? null,
      targetWordCount: item.targetWordCount ?? null,
      searchIntent: item.searchIntent ?? 'informational',
      peopleAlsoAsk: item.peopleAlsoAsk ?? [],
      titleOptions: item.titleOptions ?? [],
      competitorAngle: item.competitorAngle ?? null,
      uniqueAngle: item.uniqueAngle ?? null,
      callToAction: item.callToAction ?? null,
      entities: item.entities ?? [],
      competitorHeadlines: item.competitorHeadlines ?? [],
      source: item.source ?? 'fallback',
    }));
    return { items: normalizedItems, total };
  }

  /**
   * Delete a single content brief (team-scoped).
   */
  async deleteBrief(id, teamId) {
    const brief = await prisma.contentBrief.findFirst({ where: { id, teamId }, select: { id: true } });
    if (!brief) throw AppError.notFound('Brief');
    await prisma.contentBrief.delete({ where: { id } });
  }

  _isLegacySchemaError(err) {
    return err?.name === 'PrismaClientKnownRequestError' ||
      /content_briefs/i.test(err?.message || '') ||
      /meta_description|target_word_count|search_intent|people_also_ask|title_options|competitor_angle|unique_angle|call_to_action|entities|competitor_headlines|source/i.test(err?.message || '');
  }
}

module.exports = new ContentBriefService();
