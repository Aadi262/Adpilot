'use strict';

const axios = require('axios');
const logger = require('../../config/logger');
const anthropic = require('../ai/AnthropicService');
const gemini = require('../ai/GeminiService');
const teamContextService = require('../ai/TeamContextService');
const serpIntelligence = require('./SerpIntelligenceService');
const { withTimeout } = require('../../utils/timeout');

async function googleAutocomplete(q) {
  try {
    const url = `https://suggestqueries.google.com/complete/search?client=firefox&q=${encodeURIComponent(q)}`;
    const { data } = await withTimeout(
      axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 5000 }),
      6000
    );
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
    return Array.isArray(data) && Array.isArray(data[1]) ? data[1].slice(0, 10) : [];
  } catch {
    return [];
  }
}

async function googleTrends(q) {
  const googleTrendsApi = require('google-trends-api');

  async function fetchTrend(keyword) {
    const raw = await withTimeout(
      googleTrendsApi.interestOverTime({
        keyword,
        startTime: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      }),
      12000
    );
    const parsed = JSON.parse(raw);
    const timeline = parsed?.default?.timelineData || [];
    if (!timeline.length) return null;
    const values = timeline.map((p) => p.value?.[0] || 0);
    const first = values[0] || 0;
    const last = values[values.length - 1] || 0;
    const deltaPct = first > 0 ? Math.round(((last - first) / first) * 100) : 0;
    return {
      averageInterest: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      peakInterest: Math.max(...values),
      trend: Math.abs(deltaPct) < 8 ? 'stable' : deltaPct > 0 ? 'rising' : 'falling',
      deltaPct,
      dataPoints: timeline.slice(-12).map((p) => ({
        date: p.formattedTime,
        value: p.value?.[0] || 0,
      })),
    };
  }

  try {
    return await fetchTrend(q) || (!q.includes(' ') ? await fetchTrend(`${q} online`) : null);
  } catch (err) {
    logger.debug('KeywordResearchService: trends failed', { keyword: q, err: err.message });
    return null;
  }
}

function buildFallbackAnalysis({ keyword, trends, serpSnapshot, relatedKeywords }) {
  const avgInterest = trends?.averageInterest || 0;
  const paidAds = serpSnapshot?.paidResults?.length || 0;
  const totalResults = serpSnapshot?.totalResults || 0;
  const serpFeatures = serpSnapshot?.serpFeatures || [];
  const competitionPressure = Math.min(100, Math.round((paidAds * 12) + (serpFeatures.length * 8) + (totalResults > 1000000 ? 20 : 5)));
  const difficulty = Math.min(100, Math.max(18, competitionPressure));
  const intent = paidAds >= 3 ? 'commercial' : serpFeatures.includes('people_also_ask') ? 'informational' : 'navigational';
  const opportunityScore = Math.max(15, Math.min(100, Math.round((avgInterest * 0.55) + ((100 - difficulty) * 0.35) + (intent === 'commercial' ? 12 : 4))));

  return {
    trendScore: avgInterest,
    trendDirection: trends?.trend || 'stable',
    trendReason: trends
      ? `Interest is ${trends.trend} with a ${trends.deltaPct >= 0 ? '+' : ''}${trends.deltaPct}% 90-day change.`
      : 'Trend data is limited, so this is based on SERP momentum only.',
    difficulty,
    difficultyLabel: difficulty < 30 ? 'Easy' : difficulty < 55 ? 'Medium' : difficulty < 75 ? 'Hard' : 'Very Hard',
    intent,
    intentExplanation: paidAds >= 3
      ? 'Multiple paid ads suggest buyers are already in-market.'
      : serpFeatures.includes('people_also_ask')
      ? 'People Also Ask results suggest users are researching the topic.'
      : 'The query appears brand-led or mixed intent from the current SERP.',
    opportunityScore,
    opportunityReason: `Opportunity is driven by ${avgInterest}/100 trend interest against a difficulty score of ${difficulty}/100.`,
    serpFeatures,
    relatedKeywords: relatedKeywords.slice(0, 8).map((item) => ({
      keyword: item.keyword,
      volume: item.searchVolume,
      difficulty: Math.max(15, difficulty - 8),
      relevance: 'high',
    })),
    contentAngle: `Create a decision-stage page around "${keyword}" that answers the top questions and targets the strongest SERP gaps.`,
  };
}

async function aiInsights(payload, teamContext) {
  const prompt = `You are an SEO analyst. Given this keyword data from search APIs:
- Keyword: "${payload.keyword}"
- Search Volume: ${payload.searchVolume ?? 'null'}
- CPC: ${payload.cpc ?? 'null'}
- Competition: ${payload.competition ?? 'null'}
- Trend average: ${payload.trendAverage ?? 'null'}
- Trend change: ${payload.trendDeltaPct ?? 'null'}%
- SERP Features: ${(payload.serpFeatures || []).join(', ') || 'none'}
- Top ranking pages:
${(payload.topResults || []).slice(0, 5).map((r, i) => `${i + 1}. ${r.title} | ${r.domain || r.link}`).join('\n')}
- Related terms: ${(payload.relatedKeywords || []).map((r) => r.keyword).join(', ')}

${teamContextService.formatKeywordContext(teamContext)}

Provide analysis in this EXACT JSON format:
{
  "trendScore": <number 0-100 based on volume trajectory>,
  "trendDirection": "rising",
  "trendReason": "<one sentence>",
  "difficulty": <number 0-100>,
  "difficultyLabel": "Easy",
  "intent": "informational",
  "intentExplanation": "<why this intent>",
  "opportunityScore": <number 0-100>,
  "opportunityReason": "<why this score>",
  "serpFeatures": ["featured_snippet"],
  "relatedKeywords": [
    { "keyword": "...", "volume": null, "difficulty": 42, "relevance": "high" }
  ],
  "contentAngle": "<specific content idea>"
}

Rules:
- Use only the provided data.
- If search volume or CPC is unavailable, keep it null in your reasoning and do not invent it.
- Keep reasons concrete and reference trend, competition, and SERP composition.
- Use the team memory above to avoid repeating stale priorities and to connect this keyword to what the team already tracks.
- Return valid JSON only.`;

  try {
    let raw = null;
    if (anthropic.isAvailable) raw = await withTimeout(anthropic.generate(prompt, { maxTokens: 900, temperature: 0.3 }), 9000).catch(() => null);
    if (!raw) return null;
    return anthropic.parseJSON(raw);
  } catch {
    return null;
  }
}

async function research(q, { teamId } = {}) {
  const [googleSuggs, ddgSuggs, trendsData, serpSnapshot] = await Promise.allSettled([
    googleAutocomplete(q),
    ddgSuggest(q),
    googleTrends(q),
    serpIntelligence.getKeywordSnapshot(q),
  ]);

  const gSuggs = googleSuggs.status === 'fulfilled' ? googleSuggs.value : [];
  const dSuggs = ddgSuggs.status === 'fulfilled' ? ddgSuggs.value : [];
  const trends = trendsData.status === 'fulfilled' ? trendsData.value : null;
  const serp = serpSnapshot.status === 'fulfilled' ? serpSnapshot.value : null;

  const mergedKeywords = [...new Set([
    ...gSuggs,
    ...dSuggs,
    ...((serp?.relatedSearches) || []),
    ...((serp?.relatedQuestions) || []),
  ])]
    .filter((item) => item && item.toLowerCase() !== q.toLowerCase())
    .slice(0, 12);

  const relatedKeywords = mergedKeywords.map((keyword) => ({
    keyword,
    searchVolume: null,
    cpc: null,
  }));

  const payload = {
    keyword: q,
    searchVolume: null,
    cpc: null,
    competition: serp?.paidResults?.length ?? null,
    trendAverage: trends?.averageInterest ?? null,
    trendDeltaPct: trends?.deltaPct ?? null,
    serpFeatures: serp?.serpFeatures ?? [],
    topResults: serp?.organicResults ?? [],
    relatedKeywords,
  };

  const teamContext = teamId ? await teamContextService.getKeywordContext(teamId, q) : null;
  const insights = await aiInsights(payload, teamContext || { matchedKeywords: [], matchedBriefs: [], recentAudits: [], relatedResearch: [] });
  const analysis = insights || buildFallbackAnalysis({
    keyword: q,
    trends,
    serpSnapshot: serp,
    relatedKeywords,
  });

  return {
    keyword: q,
    searchVolume: payload.searchVolume,
    cpc: payload.cpc,
    competition: payload.competition,
    totalResults: serp?.totalResults ?? null,
    topResults: serp?.organicResults ?? [],
    relatedQuestions: serp?.relatedQuestions ?? [],
    relatedSearches: serp?.relatedSearches ?? [],
    serpFeatures: analysis.serpFeatures || serp?.serpFeatures || [],
    trends: trends || { averageInterest: 0, peakInterest: 0, trend: 'stable', deltaPct: 0, dataPoints: [] },
    analysis,
    sources: {
      googleAutocomplete: gSuggs.length > 0,
      ddgSuggest: dSuggs.length > 0,
      googleTrends: !!trends,
      valueSerp: !!serp,
      aiInsights: !!insights,
    },
  };
}

module.exports = { research, getTrends: googleTrends };
