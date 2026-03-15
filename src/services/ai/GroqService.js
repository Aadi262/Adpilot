'use strict';

const logger = require('../../config/logger');

// Free tier: 14,400 req/day, 6,000 tokens/min, 500,000 tokens/day
// Docs: https://console.groq.com/docs/openai
const GROQ_BASE = 'https://api.groq.com/openai/v1/chat/completions';

// Groq free model roster — no credit card needed
// https://console.groq.com/docs/models
// Different models are best at different tasks — see TASK_MODELS below
const ALL_MODELS = {
  // Reasoning / strategy / competitor analysis / anomaly detection
  reasoning: [
    'deepseek-r1-distill-llama-70b', // DeepSeek R1 distilled on Llama-70B — best reasoning on Groq free
    'qwen-qwq-32b',                   // Qwen QwQ — strong chain-of-thought reasoning
    'llama-3.3-70b-versatile',        // Llama 3.3 fallback
  ],
  // Creative writing — ad copy, headlines, CTAs
  creative: [
    'llama-3.3-70b-versatile',  // Best creative writing on Groq free
    'mixtral-8x7b-32768',        // Strong at diverse creative output
    'gemma2-9b-it',              // Fast for shorter creative tasks
  ],
  // Structured JSON output — parsing, extraction, classification
  structured: [
    'qwen-qwq-32b',              // Best at strict JSON on Groq
    'llama-3.3-70b-versatile',   // Good JSON compliance
    'mixtral-8x7b-32768',        // 32k context for large JSON
  ],
  // General purpose fallback
  general: [
    'llama-3.3-70b-versatile',
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'llama3-8b-8192',
  ],
};

class GroqService {
  constructor() {
    this.apiKey = process.env.GROQ_API_KEY || null;
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  async generate(prompt, opts = {}) {
    if (!this.apiKey) {
      logger.warn('GroqService: GROQ_API_KEY not set — returning null');
      return null;
    }

    const { maxTokens = 2048, temperature = 0.7, systemPrompt, task = 'general' } = opts;
    const models = ALL_MODELS[task] || ALL_MODELS.general;

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    for (const model of models) {
      try {
        const res = await fetch(GROQ_BASE, {
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

        // 429 = rate limited on this model, try next
        if (res.status === 429) {
          logger.warn(`GroqService: ${model} rate limited, trying next model`);
          continue;
        }

        if (!res.ok) {
          const body = await res.text();
          logger.error('GroqService: API error', { model, status: res.status, body: body.slice(0, 300) });
          return null;
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content ?? null;
        if (text) {
          logger.info(`GroqService: response from ${model}`, { tokens: data?.usage?.total_tokens });
          return text.trim();
        }
      } catch (err) {
        logger.error('GroqService: network error', { model, error: err.message });
        return null;
      }
    }

    logger.warn('GroqService: all models failed');
    return null;
  }

  /**
   * Generate ad copy — same interface as GeminiService.generateAds()
   */
  async generateAds(product, platform, count = 3) {
    const prompt = `You are an expert ad copywriter for ${platform} ads.

Generate ${count} high-converting ad variations for:
Product/Service: ${product.name || product}
${product.description ? `Description: ${product.description}` : ''}
${product.targetAudience ? `Target Audience: ${product.targetAudience}` : ''}

For each ad return JSON with: headline (max 30 chars for Meta, 30 for Google), primaryText (max 125 chars), description (max 30 chars), ctaType (one of: LEARN_MORE, SHOP_NOW, SIGN_UP, GET_OFFER, CONTACT_US).

Return ONLY a JSON array, no markdown, no explanation.`;

    const text = await this.generate(prompt, { task: 'creative', temperature: 0.85, maxTokens: 1024, systemPrompt: 'Return only valid JSON. No markdown fences.' });
    if (!text) return null;

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const ads = JSON.parse(cleaned);
      return Array.isArray(ads) ? ads : null;
    } catch {
      logger.warn('GroqService: failed to parse ad JSON', { text: text.slice(0, 200) });
      return null;
    }
  }

  /**
   * Analyze competitor — same interface as GeminiService.analyzeCompetitor()
   */
  async analyzeCompetitor(crawlData) {
    const prompt = `You are a competitive intelligence analyst. Analyze this competitor website data and return a JSON report.

Crawl data:
${JSON.stringify(crawlData, null, 2).slice(0, 3000)}

Return JSON with:
- targetAudience: string (who they target)
- messagingAngles: string[] (their core value props, max 5)
- adThemes: string[] (recurring themes in their copy)
- keywordGaps: { keyword: string, ourRank: null, theirEstimatedRank: number }[] (max 10 keywords we're missing)
- winBackOpportunities: { tactic: string, angle: string }[] (max 5 counter-tactics)
- counterAdTemplates: { headline: string, primaryText: string, angle: string }[] (max 3 ads)
- strengthsToTarget: string (their weakness to exploit)
- overallThreatLevel: "low" | "medium" | "high"

Return ONLY valid JSON, no markdown.`;

    const text = await this.generate(prompt, { task: 'reasoning', temperature: 0.5, maxTokens: 2048, systemPrompt: 'Return only valid JSON. No markdown fences.' });
    if (!text) return null;

    try {
      // DeepSeek R1 wraps output in <think>...</think> — strip it
      const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const cleaned = stripped.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      logger.warn('GroqService: failed to parse competitor JSON');
      return null;
    }
  }
}

module.exports = new GroqService();
