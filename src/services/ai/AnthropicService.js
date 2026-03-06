'use strict';

const Anthropic = require('@anthropic-ai/sdk');
const logger    = require('../../config/logger');

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

  /**
   * Core generation method — sends a prompt, returns raw text.
   */
  async generate(prompt, opts = {}) {
    if (!this._client) return null;

    const { maxTokens = 1200, temperature = 0.7 } = opts;

    try {
      const message = await this._client.messages.create({
        model:      this.model,
        max_tokens: maxTokens,
        messages:   [{ role: 'user', content: prompt }],
      });

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
    const prompt = `You are an expert ad copywriter. Generate exactly 3 ad variations as a JSON array.

Product/Service: ${product}${keyword ? `\nFocus Keyword: ${keyword}` : ''}
Target Audience: ${targetAudience}
Platform: ${platform || 'Meta + Google'}
Tone: ${tone || 'professional but engaging'}
Objective: ${campaignObjective || 'conversions'}

Return ONLY a valid JSON array, no markdown, no explanation:
[
  {
    "headline": "max 40 chars",
    "primaryText": "main ad copy, 2-3 sentences",
    "description": "one line, max 90 chars",
    "callToAction": "e.g. Learn More",
    "qualityScore": 85,
    "reasoning": "why this variation works"
  }
]

Variation 1: Pain-point/emotional angle
Variation 2: Benefit/value-proposition angle
Variation 3: Social proof/urgency angle

ONLY return the JSON array. No other text.`;

    const raw = await this.generate(prompt, { temperature: 0.85, maxTokens: 1000 });
    return this.parseJSON(raw);
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

    const raw = await this.generate(prompt, { temperature: 0.7, maxTokens: 1000 });
    return this.parseJSON(raw);
  }

  async analyzeCompetitor({ domain, title, description, ctas, topKeywords, techStack, headings }) {
    const headingList = (headings || []).slice(0, 5).map(h => h.text).join(', ');
    const prompt = `Analyze this competitor website and provide strategic insights.

Competitor: ${domain}
Title: ${title || 'N/A'}
Description: ${description || 'N/A'}
Main Headings: ${headingList || 'N/A'}
CTAs: ${(ctas || []).join(', ') || 'N/A'}
Top Keywords: ${(topKeywords || []).map(k => k.word || k).slice(0, 12).join(', ')}
Tech Stack: ${(techStack || []).join(', ') || 'N/A'}

Return ONLY a valid JSON object, no markdown:
{
  "keywordGaps": [{"keyword": "string", "opportunity": "brief note", "difficulty": "low"}],
  "messagingAngles": ["angle 1", "angle 2", "angle 3"],
  "weaknesses": ["weakness 1", "weakness 2", "weakness 3"],
  "strengths": ["strength 1", "strength 2"],
  "suggestedAds": [{"headline": "string", "body": "string", "angle": "string"}]
}

Return 3-5 items per array. ONLY return the JSON. No other text.`;

    const raw = await this.generate(prompt, { temperature: 0.7, maxTokens: 800 });
    return this.parseJSON(raw);
  }
}

module.exports = new AnthropicService();
