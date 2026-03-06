'use strict';

const adRepo = require('../repositories/adRepository');
const campaignRepo = require('../repositories/campaignRepository');
const { AppError } = require('../middleware/errorHandler');
const gemini      = require('./ai/GeminiService');
const ollama      = require('./ai/OllamaService');
const huggingface = require('./ai/HuggingFaceService');
const anthropic   = require('./ai/AnthropicService');

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
  // Verify campaign belongs to team
  const campaign = await campaignRepo.findByIdRaw(campaignId, teamId);
  if (!campaign) {
    throw new AppError('Campaign not found', 404);
  }

  const adParams = {
    product:           brief.productName || campaign.name,
    targetAudience:    brief.targetAudience || 'general audience',
    platform:          brief.platform || campaign.platform,
    tone:              brief.tone,
    campaignObjective: brief.objective || campaign.objective,
  };

  const toVariations = (aiResult, source) =>
    Array.isArray(aiResult)
      ? aiResult.map(v => ({
          headline:      v.headline,
          primaryText:   v.primaryText,
          description:   v.description,
          ctaType:       v.callToAction?.toUpperCase().replace(/\s+/g, '_') || 'LEARN_MORE',
          platform:      campaign.platform,
          status:        'draft',
          qualityScore:  v.qualityScore,
          reasoning:     v.reasoning,
          isAiGenerated: true,
          aiSource:      source,
        }))
      : null;

  // 1. Try Ollama (local, free, no API key)
  if (await ollama.isAvailable()) {
    const result = toVariations(await ollama.generateAds(adParams), 'ollama');
    if (result) return result;
  }

  // 2. Try Gemini (free key)
  if (gemini.isAvailable) {
    const result = toVariations(await gemini.generateAds(adParams), 'gemini');
    if (result) return result;
  }

  // 3. Try HuggingFace (free key, Mistral-7B)
  if (huggingface.isAvailable) {
    const result = toVariations(await huggingface.generateAds(adParams), 'huggingface');
    if (result) return result;
  }

  // 4. Try Anthropic Claude (paid key, very reliable)
  if (anthropic.isAvailable) {
    const result = toVariations(await anthropic.generateAds(adParams), 'anthropic');
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
