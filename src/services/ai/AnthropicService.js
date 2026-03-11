'use strict';

const crypto = require('crypto');

const Anthropic = require('@anthropic-ai/sdk');
const logger    = require('../../config/logger');
const { getRedis } = require('../../config/redis');
const { withTimeout } = require('../../utils/timeout');

/**
 * AnthropicService — Claude-based AI for ad generation, content briefs, competitor analysis.
 *
 * Model: claude-haiku-4-5-20251001 (fast, cheap, great for structured JSON output)
 * Set in .env:
 *   ANTHROPIC_API_KEY=sk-ant-...
 *   ANTHROPIC_AD_MODEL=claude-haiku-4-5-20251001   (optional override)
 *
 * Dashboard: https://console.anthropic.com/
 */
class AnthropicService {
  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY || null;
    this.model   = process.env.ANTHROPIC_AD_MODEL || 'claude-haiku-4-5-20251001';

    if (apiKey) {
      this._client = new Anthropic({ apiKey });
    } else {
      this._client = null;
      logger.debug('AnthropicService: ANTHROPIC_API_KEY not set — disabled');
    }
  }

  get isAvailable() {
    return !!this._client;
  }

  _hash(value) {
    return crypto.createHash('sha1').update(String(value || '')).digest('hex');
  }

  _cacheKey(kind, key) {
    return `anthropic:${kind}:${this._hash(key)}`;
  }

  async _readCachedJSON(key) {
    try {
      const redis = getRedis();
      const cached = await redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (err) {
      logger.debug('AnthropicService: cache read skipped', { message: err.message });
      return null;
    }
  }

  async _writeCachedJSON(key, value, ttlSeconds) {
    try {
      const redis = getRedis();
      await redis.setex(key, ttlSeconds, JSON.stringify(value));
    } catch (err) {
      logger.debug('AnthropicService: cache write skipped', { message: err.message });
    }
  }

  /**
   * Core generation method — sends a prompt, returns raw text.
   */
  async generate(prompt, opts = {}) {
    if (!this._client) return null;

    const {
      maxTokens = 1200,
      temperature = 0.2,
      timeoutMs = 12000,
      system = null,
    } = opts;

    try {
      const message = await withTimeout(
        this._client.messages.create({
          model: this.model,
          max_tokens: maxTokens,
          temperature,
          ...(system ? { system } : {}),
          messages: [{ role: 'user', content: prompt }],
        }),
        timeoutMs
      );

      return message.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim() || null;
    } catch (err) {
      const status = err.status || err.statusCode;
      if (status === 429) {
        logger.warn('AnthropicService: rate limited (429)');
      } else if (status === 529) {
        logger.warn('AnthropicService: overloaded (529)');
      } else {
        logger.error('AnthropicService.generate failed', { message: err.message });
      }
      return null;
    }
  }

  async generateJSON(prompt, opts = {}) {
    if (!this._client) return null;

    const {
      cacheKey = prompt,
      cacheTtlSeconds = 6 * 60 * 60,
      ...generateOpts
    } = opts;

    const redisKey = cacheTtlSeconds > 0 ? this._cacheKey('json', cacheKey) : null;
    if (redisKey) {
      const cached = await this._readCachedJSON(redisKey);
      if (cached) return cached;
    }

    const raw = await this.generate(prompt, generateOpts);
    const parsed = this.parseJSON(raw);
    if (!parsed) return null;

    if (redisKey) {
      await this._writeCachedJSON(redisKey, parsed, cacheTtlSeconds);
    }

    return parsed;
  }

  /**
   * Strip markdown fences and parse JSON from LLM response.
   */
  parseJSON(raw) {
    if (!raw) return null;

    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const start = cleaned.search(/[\[{]/);
    if (start === -1) return null;

    const isArray = cleaned[start] === '[';
    const end = isArray ? cleaned.lastIndexOf(']') : cleaned.lastIndexOf('}');
    if (end === -1 || end < start) return null;

    const slice = cleaned.slice(start, end + 1);

    try { return JSON.parse(slice); } catch { /* fall through */ }

    // Repair unescaped double quotes in string values
    try {
      let result = '', inString = false;
      for (let i = 0; i < slice.length; i++) {
        const ch = slice[i];
        if (!inString) {
          if (ch === '"') inString = true;
          result += ch;
        } else if (ch === '\\') {
          result += ch + (slice[i + 1] || '');
          i++;
        } else if (ch === '"') {
          let j = i + 1;
          while (j < slice.length && (slice[j] === ' ' || slice[j] === '\t')) j++;
          const next = slice[j];
          if (next === ',' || next === '}' || next === ']' || next === ':' || next === '\n' || next === '\r') {
            inString = false; result += ch;
          } else { result += '\\"'; }
        } else { result += ch; }
      }
      return JSON.parse(result);
    } catch { /* fall through */ }

    logger.warn('AnthropicService: JSON parse failed', { raw: raw.substring(0, 200) });
    return null;
  }

  async generateAds({ product, keyword, targetAudience, platform, tone, campaignObjective }) {
    const prompt = `You are an expert direct response copywriter. Generate exactly 4 ad variations using these angles: Social Proof, Problem/Solution, Curiosity, Fear of Missing Out.

Product/Service: ${product}${keyword ? `\nFocus Keyword: ${keyword}` : ''}
Target Audience: ${targetAudience || 'general audience'}
Platform: ${platform || 'Meta'}
Objective: ${campaignObjective || 'conversions'}

Return ONLY a valid JSON array, no markdown:
[
  {
    "angle": "Social Proof",
    "headline": "max 40 chars, thumb-stopping",
    "body": "2-3 sentence body copy",
    "cta": "CTA button text (2-4 words)",
    "qualityScore": 85,
    "qualityReason": "one sentence why this score"
  }
]

Use angles in this order: Social Proof, Problem/Solution, Curiosity, Fear of Missing Out.
ONLY return the JSON array. No other text.`;

    return this.generateJSON(prompt, {
      temperature: 0.55,
      maxTokens: 1000,
      cacheKey: ['ads', product, keyword, targetAudience, platform, tone, campaignObjective].filter(Boolean).join('|'),
      cacheTtlSeconds: 2 * 60 * 60,
    });
  }

  async generateContentBrief({ keyword, relatedKeywords = [] }) {
    const prompt = `You are an SEO content strategist. Generate a detailed content brief.

Target Keyword: ${keyword}
${relatedKeywords.length ? `Related Keywords: ${relatedKeywords.slice(0, 10).join(', ')}` : ''}

Return ONLY a valid JSON object, no markdown:
{
  "title": "SEO-optimized H1 title",
  "metaDescription": "150-160 char meta description",
  "targetWordCount": 1500,
  "searchIntent": "informational",
  "outline": [{"heading": "Section heading", "subpoints": ["point 1", "point 2"]}],
  "relatedKeywords": ["keyword1", "keyword2", "keyword3"],
  "competitorAngle": "how to differentiate",
  "callToAction": "primary CTA suggestion"
}

searchIntent must be one of: informational, commercial, transactional, navigational.
ONLY return the JSON. No other text.`;

    return this.generateJSON(prompt, {
      temperature: 0.2,
      maxTokens: 1000,
      cacheKey: ['brief', keyword, ...relatedKeywords].join('|'),
      cacheTtlSeconds: 12 * 60 * 60,
    });
  }

  async analyzeCompetitor({ domain, title, description, ctas, topKeywords, techStack, headings, researchBasis, teamMemory }) {
    const headingList = (headings || []).slice(0, 5).map(h => h.text).join(', ');
    const keywordLines = (topKeywords || [])
      .slice(0, 8)
      .map((k) => {
        const keyword = k.keyword || k.word || 'n/a';
        const bits = [
          `keyword=${keyword}`,
          k.position ? `competitor_rank=${k.position}` : 'competitor_rank=unconfirmed',
          k.rankSource ? `rank_source=${k.rankSource}` : 'rank_source=unknown',
          k.searchVolume ? `search_volume=${k.searchVolume}` : 'search_volume=unknown',
          Array.isArray(k.serpFeatures) && k.serpFeatures.length ? `serp_features=${k.serpFeatures.join('|')}` : 'serp_features=none',
        ];
        return `- ${bits.join(', ')}`;
      })
      .join('\n');

    const prompt = `Analyze this competitor website and provide evidence-backed strategic insights.

Competitor: ${domain}
Title: ${title || 'N/A'}
Description: ${description || 'N/A'}
Main Headings: ${headingList || 'N/A'}
CTAs: ${(ctas || []).join(', ') || 'N/A'}
Top Keywords:
${keywordLines || '- none'}
Tech Stack: ${(techStack || []).join(', ') || 'N/A'}
Observed Research Basis:
${(researchBasis || []).join('\n') || '- none'}
${teamMemory ? `\n${teamMemory}\n` : ''}

Return ONLY a valid JSON object, no markdown:
{
  "keywordGaps": [{"keyword": "string", "evidence": "specific observed evidence", "difficulty": "low|medium|high|null", "move": "specific action"}],
  "messagingAngles": [{"angle": "string", "evidence": "specific observed evidence", "counterPositioning": "how to beat it"}],
  "weaknesses": [{"issue": "string", "evidence": "specific observed evidence", "impact": "why it matters"}],
  "strengths": [{"issue": "string", "evidence": "specific observed evidence"}],
  "winbackOpportunities": [{"title": "string", "evidence": "specific evidence of lost or weak coverage", "action": "specific action", "targetKeyword": "string|null"}],
  "suggestedAds": [{"headline": "max 30 chars", "body": "max 90 chars", "angle": "string", "evidence": "specific observed evidence", "cta": "string", "targetAudience": "string"}],
  "dataGapNotes": ["missing data that prevents stronger conclusions"]
}

Rules:
- Use only the observed evidence above. Do not invent ad spend, traffic, search volume, or ranking loss.
- If evidence is weak for a section, return an empty array for that section.
- Only return winbackOpportunities if the evidence explicitly supports a recovery or intercept play. Otherwise return [].
- A valid winback must reference one of the observed keywords above and explain the specific weakness or intercept point.
- Keep every recommendation concrete and tied to an observed keyword, CTA, heading, or SERP feature.

Return 0-3 items per array. ONLY return the JSON. No other text.`;

    return this.generateJSON(prompt, {
      temperature: 0.15,
      maxTokens: 800,
      cacheKey: ['competitor', domain, title, description, keywordLines, headingList, (researchBasis || []).join('|'), teamMemory || ''].join('|'),
      cacheTtlSeconds: 12 * 60 * 60,
    });
  }
}

module.exports = new AnthropicService();
