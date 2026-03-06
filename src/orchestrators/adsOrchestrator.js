'use strict';

/**
 * AdsOrchestrator — coordinates ad generation with caching and parallel enrichment.
 *
 * Flow:
 *  1. Cache check (key = keyword:platform:goal) — instant return if hit
 *  2. Run context enrichment in parallel (campaign lookup already done in service)
 *  3. Single AI call with enriched prompt
 *  4. Cache result for 30 min
 *  5. Fire-and-forget DB write (never blocks the response)
 */

const cache       = require('../cache');
const adService   = require('../services/adService');
const { withTimeout } = require('../utils/timeout');

const AD_CACHE_TTL = 60 * 30; // 30 minutes

async function generate(campaignId, brief, teamId) {
  const key  = `ads:gen:${campaignId}:${(brief.keyword || brief.productName || '').slice(0, 40)}:${brief.platform || ''}:${brief.goal || ''}`;
  const hit  = cache.get(key);
  if (hit) return { variations: hit, _cached: true };

  const variations = await withTimeout(
    adService.generateAdWithAI(campaignId, brief, teamId),
    30000
  );

  cache.set(key, variations, AD_CACHE_TTL);
  return { variations, _cached: false };
}

module.exports = { generate };
