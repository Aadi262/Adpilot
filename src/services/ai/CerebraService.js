'use strict';

const logger = require('../../config/logger');

// Cerebras Inference — FREE, no credit card required
// 1,000,000 tokens/day free tier, 30 req/min
// Runs on custom silicon — ~20x faster than GPU providers (hundreds tok/s)
// Docs: https://inference-docs.cerebras.ai
const CEREBRAS_BASE = 'https://api.cerebras.ai/v1/chat/completions';

// Task-specific model routing — all on Cerebras free tier
const TASK_MODELS = {
  // Reasoning: strategy, competitor intel, anomaly detection, SEO analysis
  reasoning: [
    'qwen-3-32b',           // Qwen3 32B — strong chain-of-thought on Cerebras
    'llama3.3-70b',         // Llama 3.3 70B — reliable reasoning fallback
  ],
  // Creative: ad copy, headlines, hooks, CTAs
  creative: [
    'llama3.3-70b',         // Llama 3.3 70B — best creative output
    'qwen-3-32b',           // Qwen3 fallback
  ],
  // Structured JSON: parsing, classification, extraction
  structured: [
    'qwen-3-32b',           // Qwen3 — excellent JSON compliance
    'llama3.3-70b',         // Llama 3.3 fallback
  ],
  general: [
    'llama3.3-70b',
    'qwen-3-32b',
  ],
};

class CerebraService {
  constructor() {
    this.apiKey = process.env.CEREBRAS_API_KEY || null;
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  async generate(prompt, opts = {}) {
    if (!this.apiKey) {
      logger.warn('CerebraService: CEREBRAS_API_KEY not set — returning null');
      return null;
    }

    const { maxTokens = 2048, temperature = 0.7, systemPrompt, task = 'general' } = opts;
    const models = TASK_MODELS[task] || TASK_MODELS.general;

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    for (const model of models) {
      try {
        const res = await fetch(CEREBRAS_BASE, {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens:  maxTokens,
            temperature,
          }),
        });

        if (res.status === 429) {
          logger.warn(`CerebraService: ${model} rate limited (30 RPM), trying next`);
          continue;
        }

        if (!res.ok) {
          const body = await res.text();
          logger.error('CerebraService: API error', { model, status: res.status, body: body.slice(0, 300) });
          continue;
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content ?? null;
        if (text) {
          logger.info(`CerebraService: response from ${model}`, { tokens: data?.usage?.total_tokens });
          return text.trim();
        }
      } catch (err) {
        logger.error('CerebraService: network error', { model, error: err.message });
        return null;
      }
    }

    logger.warn('CerebraService: all models failed');
    return null;
  }

  async generateAds(adParams) {
    const { product, keyword, targetAudience, platform, tone, campaignObjective } = adParams;
    const prompt = `You are an expert ${platform} ad copywriter. Generate 4 high-converting ad variations.

Product: ${product}
${keyword ? `Main keyword: ${keyword}` : ''}
${targetAudience ? `Target audience: ${targetAudience}` : ''}
${tone ? `Tone: ${tone}` : ''}
${campaignObjective ? `Objective: ${campaignObjective}` : ''}
Platform: ${platform}

Each variation needs a different angle: Social Proof, Problem/Solution, Curiosity, FOMO.

Return ONLY a JSON array with objects:
{ "angle": string, "headline": string (max 30 chars), "body": string (max 125 chars), "cta": string, "displayUrl": string, "hook": string, "bestFor": string, "targetAudienceNote": string }

No markdown, no explanation — only the raw JSON array.`;

    const text = await this.generate(prompt, {
      task:         'creative',
      temperature:  0.85,
      maxTokens:    1024,
      systemPrompt: 'Return only a valid JSON array. No markdown fences, no explanation.',
    });
    if (!text) return null;

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const ads = JSON.parse(cleaned);
      return Array.isArray(ads) ? ads : null;
    } catch {
      logger.warn('CerebraService: failed to parse ad JSON', { text: text.slice(0, 200) });
      return null;
    }
  }

  async analyzeCompetitor(crawlData) {
    const prompt = `You are a competitive intelligence analyst. Analyze this competitor website data.

Data:
${JSON.stringify(crawlData, null, 2).slice(0, 3000)}

Return JSON with:
- targetAudience: string
- messagingAngles: string[] (max 5)
- adThemes: string[] (max 5)
- keywordGaps: { keyword: string, ourRank: null, theirEstimatedRank: number }[] (max 10)
- winBackOpportunities: { tactic: string, angle: string }[] (max 5)
- counterAdTemplates: { headline: string, primaryText: string, angle: string }[] (max 3)
- strengthsToTarget: string
- overallThreatLevel: "low" | "medium" | "high"

Return ONLY valid JSON, no markdown.`;

    const text = await this.generate(prompt, {
      task:         'reasoning',
      temperature:  0.5,
      maxTokens:    2048,
      systemPrompt: 'Return only valid JSON. No markdown fences.',
    });
    if (!text) return null;

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      logger.warn('CerebraService: failed to parse competitor JSON');
      return null;
    }
  }
}

module.exports = new CerebraService();
