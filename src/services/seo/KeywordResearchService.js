'use strict';

/**
 * KeywordResearchService — free keyword data using:
 *   1. Google Autocomplete  (no key, ~10 suggestions)
 *   2. DuckDuckGo Suggest   (no key, ~10 more)
 *   3. Google Trends        (no key via google-trends-api)
 *   4. Anthropic/Gemini AI  (difficulty + intent labels)
 *
 * All sources are best-effort — failures are swallowed and
 * the response is built from whatever succeeded.
 */

const axios        = require('axios');
const logger       = require('../../config/logger');
const anthropic    = require('../ai/AnthropicService');
const gemini       = require('../ai/GeminiService');
const { withTimeout } = require('../../utils/timeout');

// ── Source helpers ────────────────────────────────────────────────────────────

async function googleAutocomplete(q) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
    const { data } = await withTimeout(
      axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }),
      6000
    );
    // Response format: [query, [suggestion1, suggestion2, ...]]
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

async function ddgSuggest(q) {
  try {
    const url = `https://duckduckgo.com/ac/?q=${encodeURIComponent(q)}&type=list`;
    const { data } = await withTimeout(
      axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }),
      6000
    );
    // Response format: [query, [suggestion1, suggestion2, ...]]
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

async function googleTrends(q) {
  try {
    const googleTrendsApi = require('google-trends-api');
    const raw = await withTimeout(
      googleTrendsApi.interestOverTime({ keyword: q, startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }),
      10000
    );
    const parsed = JSON.parse(raw);
    const timeline = parsed?.default?.timelineData || [];
    const values   = timeline.map(p => p.value?.[0] || 0);
    return {
      averageInterest: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0,
      peakInterest:    values.length ? Math.max(...values) : 0,
      trend:           values.length >= 2
        ? (values[values.length - 1] > values[0] ? 'rising' : 'declining')
        : 'stable',
      dataPoints:      timeline.slice(-12).map(p => ({
        date:  p.formattedTime,
        value: p.value?.[0] || 0,
      })),
    };
  } catch (err) {
    logger.debug('KeywordResearchService: trends failed', { err: err.message });
    return null;
  }
}

async function aiInsights(q, suggestions) {
  const prompt = `Analyze this keyword and related suggestions for SEO/PPC use.

Keyword: "${q}"
Related suggestions: ${suggestions.slice(0, 8).join(', ')}

Return ONLY valid JSON (no markdown):
{
  "difficulty": "low|medium|high",
  "intent": "informational|commercial|transactional|navigational",
  "estimatedCpc": "$X.XX",
  "targetedAngles": ["angle 1", "angle 2", "angle 3"],
  "negativeKeywords": ["neg 1", "neg 2"],
  "summary": "1-sentence analysis"
}`;

  try {
    // Prefer Anthropic (fast Haiku), fall back to Gemini
    let raw = null;
    if (anthropic.isAvailable) raw = await withTimeout(anthropic.generate(prompt, { maxTokens: 400 }), 8000);
    if (!raw && gemini.isAvailable) raw = await withTimeout(gemini._generate(prompt), 8000);
    if (!raw) return null;
    return anthropic.parseJSON(raw);
  } catch {
    return null;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

async function research(q) {
  // Run all free sources in parallel
  const [googleSuggs, ddgSuggs, trendsData] = await Promise.allSettled([
    googleAutocomplete(q),
    ddgSuggest(q),
    googleTrends(q),
  ]);

  const gSuggs = googleSuggs.status === 'fulfilled' ? googleSuggs.value : [];
  const dSuggs = ddgSuggs.status   === 'fulfilled' ? ddgSuggs.value   : [];
  const trends = trendsData.status === 'fulfilled' ? trendsData.value : null;

  // Deduplicate + merge suggestions
  const allSugg = [...new Set([...gSuggs, ...dSuggs])].filter(s => s !== q);

  // AI analysis on combined data (non-blocking — failure graceful)
  const insights = await aiInsights(q, allSugg).catch(() => null);

  return {
    keyword:      q,
    suggestions:  allSugg,
    trends:       trends || { averageInterest: 0, peakInterest: 0, trend: 'unknown', dataPoints: [] },
    insights:     insights || {
      difficulty: 'medium',
      intent:     'commercial',
      estimatedCpc: 'N/A',
      targetedAngles: [],
      negativeKeywords: [],
      summary: 'AI analysis unavailable',
    },
    sources: {
      googleAutocomplete: gSuggs.length > 0,
      ddgSuggest:         dSuggs.length > 0,
      googleTrends:       !!trends,
      aiInsights:         !!insights,
    },
  };
}

module.exports = { research };
