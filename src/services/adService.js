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
const TIMEOUT_MS = { ollama: 8000, gemini: 8000, huggingface: 10000, anthropic: 8000 };

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

  const ANGLES = ['Social Proof', 'Problem/Solution', 'Curiosity', 'Fear of Missing Out'];
  const keywordLower = (adParams.keyword || adParams.product || '').toLowerCase();

  const scoreVariation = (variation) => {
    const headline = String(variation.headline || '').trim();
    const body = String(variation.body || variation.primaryText || variation.description || '').trim();
    const cta = String(variation.cta || variation.callToAction || '').trim();
    const combined = `${headline} ${body}`.toLowerCase();

    const relevance = Math.min(100, 45 + (keywordLower && combined.includes(keywordLower) ? 30 : 0) + (headline.length >= 10 && headline.length <= 30 ? 15 : 5));
    const emotionalTrigger = Math.min(100, 35 + (/(save|secret|fear|limited|trusted|proven|fast|now|free|exclusive)/i.test(`${headline} ${body}`) ? 35 : 10) + (/!/.test(body) ? 10 : 0));
    const ctaClarity = Math.min(100, 40 + (cta.length >= 2 ? 20 : 0) + (/(start|book|buy|learn|try|get|download|shop)/i.test(cta) ? 25 : 10));
    const uniqueness = Math.min(100, 40 + new Set(combined.split(/\s+/).filter(Boolean)).size);
    const qualityScore = Math.round((relevance * 0.35) + (emotionalTrigger * 0.2) + (ctaClarity * 0.2) + (uniqueness * 0.25));

    return {
      relevance,
      emotionalTrigger,
      ctaClarity,
      uniqueness,
      qualityScore,
      qualityReason: `Relevance ${relevance}/100, emotional trigger ${emotionalTrigger}/100, CTA clarity ${ctaClarity}/100, uniqueness ${uniqueness}/100.`,
    };
  };

  const toVariations = (aiResult, source) =>
    Array.isArray(aiResult)
      ? aiResult.map((v, i) => ({
          ...scoreVariation(v),
          // New frontend format
          angle:         v.angle || ANGLES[i % ANGLES.length],
          headline:      v.headline,
          body:          v.body || v.primaryText || v.description || '',
          cta:           v.cta || v.callToAction || 'Learn More',
          displayUrl:    v.displayUrl || 'adpilot.io',
          sitelinks:     Array.isArray(v.sitelinks) ? v.sitelinks : ['Pricing', 'Demo', 'Case Studies'],
          targetAudienceNote: v.targetAudienceNote || adParams.targetAudience,
          hook:          v.hook || '',
          bestFor:       v.bestFor || '',
          // Legacy format kept for save-to-campaign flow
          primaryText:   v.body || v.primaryText || '',
          callToAction:  v.cta || v.callToAction || 'Learn More',
          platform:      campaign?.platform || brief.platform || 'meta',
          status:        'draft',
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

  // 1. Try Ollama (local, free, zero cost)
  if (await ollama.isAvailable()) {
    const result = await tryProvider('ollama', () => ollama.generateAds(adParams));
    if (result) return result;
  }

  // 2. Try Gemini (free tier)
  if (gemini.isAvailable) {
    const result = await tryProvider('gemini', () => gemini.generateAds(adParams));
    if (result) return result;
  }

  // 3. Try HuggingFace (free, Mistral-7B)
  if (huggingface.isAvailable) {
    const result = await tryProvider('huggingface', () => huggingface.generateAds(adParams));
    if (result) return result;
  }

  // 4. Try Anthropic Claude (paid fallback)
  if (anthropic.isAvailable) {
    const result = await tryProvider('anthropic', () => anthropic.generateAds(adParams));
    if (result) return result;
  }

  // Fallback: mock variations (labelled as mock)
  const pl = campaign?.platform || brief.platform || 'meta';
  const prod = brief.productName || brief.keyword || 'Your Product';
  return [
    { angle: 'Social Proof', headline: `${prod} Trusted Daily`.slice(0, 30), body: `See why customers choose ${prod} to get faster results.`, cta: 'Learn More', displayUrl: 'adpilot.io', sitelinks: ['Reviews', 'Demo'], targetAudienceNote: adParams.targetAudience, platform: pl, status: 'draft', isMock: true },
    { angle: 'Problem/Solution', headline: `Fix ${prod} Pain Fast`.slice(0, 30), body: `${prod} solves the biggest blocker stopping conversions right now.`, cta: 'Try Today', displayUrl: 'adpilot.io', sitelinks: ['Pricing', 'Features'], targetAudienceNote: adParams.targetAudience, platform: pl, status: 'draft', isMock: true },
    { angle: 'Curiosity', headline: `Why Top Teams Pick ${prod}`.slice(0, 30), body: `The fastest-growing teams are switching to ${prod}. See what they know.`, cta: 'Find Out', displayUrl: 'adpilot.io', sitelinks: ['How It Works', 'Results'], targetAudienceNote: adParams.targetAudience, platform: pl, status: 'draft', isMock: true },
    { angle: 'Fear of Missing Out', headline: `Don’t Miss ${prod}`.slice(0, 30), body: `Move before your competitors do. ${prod} helps teams capture demand faster.`, cta: 'Act Now', displayUrl: 'adpilot.io', sitelinks: ['Demo', 'Pricing'], targetAudienceNote: adParams.targetAudience, platform: pl, status: 'draft', isMock: true },
  ].map((variation) => ({ ...variation, ...scoreVariation(variation) }));
}

module.exports = {
  getAdsByCampaign,
  createAd,
  updateAd,
  deleteAd,
  generateAdWithAI,
};
