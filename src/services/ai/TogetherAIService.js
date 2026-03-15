'use strict';

const logger = require('../../config/logger');

// Together AI — $5 free credits on signup, then $0.0002/1k tokens (very cheap)
// Docs: https://docs.together.ai/reference/chat-completions
// Huge model library: Qwen, DeepSeek, Llama, Mistral, etc.
const TOGETHER_BASE = 'https://api.together.xyz/v1/chat/completions';

// Task-specific model routing — each task gets the best model for it
// Full list: https://api.together.xyz/models
const TASK_MODELS = {
  // Deep reasoning: strategic analysis, competitor intelligence, anomaly detection
  reasoning: [
    'deepseek-ai/DeepSeek-R1',                    // DeepSeek R1 — best open source reasoner
    'deepseek-ai/DeepSeek-V3',                    // DeepSeek V3 — strong reasoning
    'Qwen/Qwen2.5-72B-Instruct-Turbo',            // Qwen 2.5 72B fallback
  ],
  // Creative writing — ad copy, headlines, CTAs
  creative: [
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',   // Llama 3.3 — best for creative
    'Qwen/Qwen2.5-72B-Instruct-Turbo',            // Qwen creative fallback
    'mistralai/Mixtral-8x7B-Instruct-v0.1',       // Mixtral for diversity
  ],
  // Structured JSON output
  structured: [
    'Qwen/Qwen2.5-72B-Instruct-Turbo',            // Qwen — excellent JSON compliance
    'deepseek-ai/DeepSeek-V3',                    // DeepSeek for structured output
    'Qwen/Qwen2.5-7B-Instruct-Turbo',             // Fast structured output
  ],
  // General purpose
  general: [
    'Qwen/Qwen2.5-72B-Instruct-Turbo',
    'meta-llama/Llama-3.3-70B-Instruct-Turbo',
    'Qwen/Qwen2.5-7B-Instruct-Turbo',
  ],
};

class TogetherAIService {
  constructor() {
    this.apiKey = process.env.TOGETHER_API_KEY || null;
  }

  get isAvailable() {
    return !!this.apiKey;
  }

  async generate(prompt, opts = {}) {
    if (!this.apiKey) {
      logger.warn('TogetherAIService: TOGETHER_API_KEY not set — returning null');
      return null;
    }

    const { maxTokens = 2048, temperature = 0.7, systemPrompt, task = 'general' } = opts;
    const models = TASK_MODELS[task] || TASK_MODELS.general;

    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: prompt });

    for (const model of models) {
      try {
        const res = await fetch(TOGETHER_BASE, {
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
          logger.warn(`TogetherAIService: ${model} rate limited, trying next`);
          continue;
        }

        if (!res.ok) {
          const body = await res.text();
          logger.error('TogetherAIService: API error', { model, status: res.status, body: body.slice(0, 300) });
          continue;
        }

        const data = await res.json();
        const text = data?.choices?.[0]?.message?.content ?? null;
        if (text) {
          logger.info(`TogetherAIService: response from ${model}`, { tokens: data?.usage?.total_tokens });
          return text.trim();
        }
      } catch (err) {
        logger.error('TogetherAIService: network error', { model, error: err.message });
        return null;
      }
    }

    logger.warn('TogetherAIService: all models failed');
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

Return ONLY a JSON array with objects: { angle, headline (max 30 chars), body (max 125 chars), cta, displayUrl, hook, bestFor, targetAudienceNote }

No markdown, no explanation — only the JSON array.`;

    const text = await this.generate(prompt, {
      task:         'creative',
      temperature:  0.85,
      maxTokens:    1200,
      systemPrompt: 'You are an ad copywriter. Return only valid JSON arrays. No markdown, no explanation.',
    });
    if (!text) return null;

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      const ads = JSON.parse(cleaned);
      return Array.isArray(ads) ? ads : null;
    } catch {
      logger.warn('TogetherAIService: failed to parse ad JSON', { text: text.slice(0, 200) });
      return null;
    }
  }

  async analyzeCompetitor(crawlData) {
    const prompt = `Analyze this competitor website data and return a JSON intelligence report.

Data:
${JSON.stringify(crawlData, null, 2).slice(0, 3000)}

Return JSON with: targetAudience, messagingAngles (string[]), adThemes (string[]), keywordGaps ({ keyword, ourRank: null, theirEstimatedRank }[]), winBackOpportunities ({ tactic, angle }[]), counterAdTemplates ({ headline, primaryText, angle }[]), strengthsToTarget, overallThreatLevel ("low"|"medium"|"high")

Only valid JSON, no markdown.`;

    const text = await this.generate(prompt, {
      task:         'reasoning',  // DeepSeek R1 for strategic competitor analysis
      temperature:  0.5,
      maxTokens:    2048,
      systemPrompt: 'Return only valid JSON. No markdown fences.',
    });
    if (!text) return null;

    try {
      // DeepSeek R1 wraps thinking in <think>...</think> — strip before parsing
      const stripped = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
      const cleaned  = stripped.replace(/```json\n?/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      logger.warn('TogetherAIService: failed to parse competitor JSON');
      return null;
    }
  }
}

module.exports = new TogetherAIService();
