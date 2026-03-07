'use strict';

const adRepo = require('../repositories/adRepository');
const campaignRepo = require('../repositories/campaignRepository');
const { AppError } = require('../middleware/errorHandler');
const gemini      = require('./ai/GeminiService');
const ollama      = require('./ai/OllamaService');
const huggingface = require('./ai/HuggingFaceService');
const anthropic   = require('./ai/AnthropicService');
const { withTimeout } = require('../utils/timeout');

// Per-provider timeouts — Ollama is local but can be slow on first token
const TIMEOUT_MS = { ollama: 8000, gemini: 12000, huggingface: 12000, anthropic: 10000 };

async function getAdsByCampaign(campaignId, teamId) {
  // Verify campaign belongs to team
  const campaign = await campaignRepo.findByIdRaw(campaignId, teamId);
  if (!campaign) {
    throw new AppError('Campaign not found', 404);
  }
  return adRepo.findByCampaign(campaignId);
}

async function createAd(campaignId, data) {
  return adRepo.create({ ...data, campaignId });
}

async function updateAd(id, data) {
  const ad = await adRepo.findById(id);
  if (!ad) {
    throw new AppError('Ad not found', 404);
  }
  return adRepo.update(id, data);
}

async function deleteAd(id) {
  const ad = await adRepo.findById(id);
  if (!ad) {
    throw new AppError('Ad not found', 404);
  }
  return adRepo.deleteOne(id);
}

async function generateAdWithAI(campaignId, brief, teamId) {
  // Campaign lookup is optional — allows generation without a campaign context
  let campaign = null;
  if (campaignId) {
    campaign = await campaignRepo.findByIdRaw(campaignId, teamId);
    if (!campaign) throw new AppError('Campaign not found', 404);
  }

  const adParams = {
    product:           brief.productName || brief.keyword || campaign?.name || 'your product',
    keyword:           brief.keyword,
    targetAudience:    brief.targetAudience || 'general audience',
    platform:          brief.platform || campaign?.platform || 'meta',
    tone:              brief.tone,
    campaignObjective: brief.goal || brief.objective || campaign?.objective,
  };

  const toVariations = (aiResult, source) =>
    Array.isArray(aiResult)
      ? aiResult.map(v => ({
          headline:      v.headline,
          primaryText:   v.primaryText,
          description:   v.description,
          ctaType:       v.callToAction?.toUpperCase().replace(/\s+/g, '_') || 'LEARN_MORE',
          platform:      campaign?.platform || brief.platform || 'meta',
          status:        'draft',
          qualityScore:  v.qualityScore,
          reasoning:     v.reasoning,
          isAiGenerated: true,
          aiSource:      source,
        }))
      : null;

  // Helper: call a provider with timeout — returns null on timeout/error
  const tryProvider = async (label, fn) => {
    try {
      return toVariations(await withTimeout(fn(), TIMEOUT_MS[label] || 10000), label);
    } catch { return null; }
  };

  // 1. Try Anthropic Claude first (most reliable, has key)
  if (anthropic.isAvailable) {
    const result = await tryProvider('anthropic', () => anthropic.generateAds(adParams));
    if (result) return result;
  }

  // 2. Try Gemini (free key)
  if (gemini.isAvailable) {
    const result = await tryProvider('gemini', () => gemini.generateAds(adParams));
    if (result) return result;
  }

  // 3. Try Ollama (local — slow on first token, 8s timeout)
  if (await ollama.isAvailable()) {
    const result = await tryProvider('ollama', () => ollama.generateAds(adParams));
    if (result) return result;
  }

  // 4. Try HuggingFace (free key, Mistral-7B)
  if (huggingface.isAvailable) {
    const result = await tryProvider('huggingface', () => huggingface.generateAds(adParams));
    if (result) return result;
  }

  // Fallback: mock variations (labelled as mock)
  return [
    {
      headline:    `${brief.productName || 'Your Product'} – Trusted by Thousands`,
      primaryText: `Discover how ${brief.productName || 'our solution'} can transform your business. ${brief.keyBenefit || 'Get results fast.'}`,
      description: 'Learn more and get started today.',
      ctaType:     'LEARN_MORE',
      platform:    campaign.platform,
      status:      'draft',
      isMock:      true,
    },
    {
      headline:    `${brief.offer || 'Limited Time'} – Act Now`,
      primaryText: `Don't miss out on ${brief.productName || 'this offer'}. ${brief.urgency || 'Limited spots available.'}`,
      description: "Claim your spot before it's too late.",
      ctaType:     'SIGN_UP',
      platform:    campaign.platform,
      status:      'draft',
      isMock:      true,
    },
    {
      headline:    `Why Choose ${brief.productName || 'Us'}?`,
      primaryText: `${brief.differentiator || 'We deliver results that matter.'} Join thousands of happy customers.`,
      description: 'See the difference for yourself.',
      ctaType:     'GET_QUOTE',
      platform:    campaign.platform,
      status:      'draft',
      isMock:      true,
    },
  ];
}

module.exports = {
  getAdsByCampaign,
  createAd,
  updateAd,
  deleteAd,
  generateAdWithAI,
};
