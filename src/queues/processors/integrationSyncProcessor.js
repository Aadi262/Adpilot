'use strict';

const prisma              = require('../../config/prisma');
const IntegrationService  = require('../../services/integrations/IntegrationService');
const MetricsCalculator   = require('../../services/analytics/MetricsCalculator');
const AnalyticsAggregator = require('../../services/analytics/AnalyticsAggregator');
const logger              = require('../../config/logger');

/**
 * Write a CampaignMetricSnapshot row for today.
 * Uses upsert so re-running the same sync on the same day merges rather than duplicates.
 */
async function writeSnapshot(campaignId, teamId, metrics, source) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0); // normalize to start of day UTC

  const { spend, revenue, clicks, impressions, conversions, ctr, cpa, roas,
          frequency, impressionShare, isLostBudget } = metrics;

  await prisma.campaignMetricSnapshot.upsert({
    where:  { campaignId_date: { campaignId, date: today } },
    update: { spend, revenue, clicks, impressions, conversions, ctr, cpa, roas,
              frequency: frequency ?? null,
              impressionShare: impressionShare ?? null,
              isLostBudget: isLostBudget ?? null,
              source },
    create: { campaignId, teamId, date: today, spend, revenue, clicks, impressions,
              conversions, ctr, cpa, roas,
              frequency: frequency ?? null,
              impressionShare: impressionShare ?? null,
              isLostBudget: isLostBudget ?? null,
              source },
  });
}

/**
 * Integration Sync Processor
 *
 * Job data: { teamId, provider, dateFrom?, dateTo? }
 *
 * Flow:
 *  1. Fetch platform campaign data via IntegrationService.syncData()
 *  2. For each platform campaign record:
 *     a. Find matching AdPilot campaign by externalId stored in performance JSON
 *     b. Fall back to name match if no externalId known yet
 *     c. Merge metrics into performance JSON (read-modify-write)
 *     d. Store externalId + budget resource name for future fast lookups
 *  3. Invalidate analytics cache so next dashboard load reflects new data
 *  4. Each campaign persisted independently — partial failures don't abort the batch
 *
 * Performance JSON keys written:
 *   {platform}_campaign_id     — external campaign ID (e.g. "meta_campaign_id")
 *   {platform}_budget_resource — Google Ads budget resource name
 *   spend, clicks, impressions, conversions, roas, ctr — always merged at root level
 */
module.exports = async function integrationSyncProcessor(job) {
  // Sweep mode: find all active integrations and enqueue individual sync jobs
  if (job.data._sweep) {
    const { queues } = require('../index');
    const integrations = await prisma.integration.findMany({
      where:  { status: 'active' },
      select: { teamId: true, provider: true },
    });

    let enqueued = 0;
    for (const { teamId, provider } of integrations) {
      if (provider === 'slack') continue; // Slack has no performance data
      await queues.integrationSync.add({ teamId, provider }, {
        attempts:         2,
        backoff:          { type: 'exponential', delay: 30_000 },
        removeOnComplete: 10,
        removeOnFail:     20,
      });
      enqueued++;
    }

    logger.info('Integration sync sweep: enqueued jobs', { total: integrations.length, enqueued });
    return { swept: true, enqueued };
  }

  const { teamId, provider, dateFrom, dateTo } = job.data;

  // Default date range: last 7 days
  const to   = dateTo   || toDateString(new Date());
  const from = dateFrom || toDateString(daysAgo(7));

  logger.info('Integration sync started', { teamId, provider, from, to });

  // ── 1. Fetch platform data ───────────────────────────────────────────────
  let platformCampaigns;
  try {
    platformCampaigns = await IntegrationService.syncData(teamId, provider, {
      dateFrom: from,
      dateTo:   to,
    });
  } catch (err) {
    logger.error('Integration sync: fetchData failed', { teamId, provider, error: err.message });
    throw err; // Let Bull retry
  }

  if (!platformCampaigns.length) {
    logger.info('Integration sync: no campaigns returned from platform', { teamId, provider });
    return { synced: 0, unmatched: 0 };
  }

  // ── 2. Load all team campaigns once (avoid N+1 queries) ─────────────────
  const teamCampaigns = await prisma.campaign.findMany({
    where: { teamId, deletedAt: null },
    select: { id: true, name: true, platform: true, performance: true },
  });

  const externalIdKey     = (p) => `${p}_campaign_id`;
  const budgetResourceKey = (p) => `${p}_budget_resource`;

  // Build lookup indexes for O(1) matching
  const byExternalId = new Map(); // "meta_campaign_id:123" → campaign
  const byName       = new Map(); // lowercased name → campaign (fallback)

  for (const c of teamCampaigns) {
    const perf = c.performance || {};
    const extId = perf[externalIdKey(provider)];
    if (extId) byExternalId.set(String(extId), c);
    byName.set(c.name.toLowerCase().trim(), c);
  }

  // ── 3. Match and persist ─────────────────────────────────────────────────
  let synced       = 0;
  let unmatched    = 0;
  let snapshots    = 0;
  let totalSpend   = 0;
  let totalClicks  = 0;
  let roasValues   = [];

  for (const platformRecord of platformCampaigns) {
    try {
      // Find match: external ID first, name fallback
      let matched = byExternalId.get(String(platformRecord.externalId));
      if (!matched) {
        matched = byName.get((platformRecord.name || '').toLowerCase().trim());
      }

      if (!matched) {
        logger.debug('Integration sync: no matching campaign found', {
          provider,
          externalId: platformRecord.externalId,
          name:       platformRecord.name,
        });
        unmatched++;
        continue;
      }

      // Read existing performance to preserve non-sync fields
      const existing = matched.performance || {};

      // Derive calculated metrics
      const spend       = Number(platformRecord.spend)       || 0;
      const revenue     = Number(existing.revenue)           || 0; // revenue not from ad platform sync
      const clicks      = Number(platformRecord.clicks)      || 0;
      const impressions = Number(platformRecord.impressions) || 0;
      const conversions = Number(platformRecord.conversions) || 0;
      const ctr         = MetricsCalculator.ctr(clicks, impressions);
      const cpa         = MetricsCalculator.cpa(spend, conversions);
      const roas        = MetricsCalculator.roas(revenue, spend);

      // Platform-specific signals
      const frequency       = Number(platformRecord.frequency)       || null;
      const impressionShare = Number(platformRecord.impressionShare) || null;
      const isLostBudget    = Number(platformRecord.isLostBudget)    || null;

      const merged = {
        ...existing,
        spend, clicks, impressions, conversions, ctr, cpa, roas,
        ...(frequency       !== null ? { frequency }       : {}),
        ...(impressionShare !== null ? { impressionShare } : {}),
        ...(isLostBudget    !== null ? { isLostBudget }    : {}),
        [externalIdKey(provider)]: String(platformRecord.externalId),
        ...(platformRecord.budgetResourceName
          ? { [budgetResourceKey(provider)]: platformRecord.budgetResourceName }
          : {}),
        ...(platformRecord.customerId
          ? { [`${provider}_account_id`]: platformRecord.customerId }
          : {}),
        lastSyncedAt: new Date().toISOString(),
      };

      // Persist performance JSON on campaign
      await prisma.campaign.update({
        where: { id: matched.id },
        data:  { performance: merged },
      });

      // Write daily CampaignMetricSnapshot — this is what powers real analytics charts
      await writeSnapshot(matched.id, teamId, {
        spend, revenue, clicks, impressions, conversions, ctr, cpa, roas,
        frequency, impressionShare, isLostBudget,
      }, provider);
      snapshots++;

      // Accumulate totals for sync result summary
      totalSpend  += spend;
      totalClicks += clicks;
      if (roas > 0) roasValues.push(roas);

      // Keep index current for later iterations
      byExternalId.set(String(platformRecord.externalId), { ...matched, performance: merged });

      synced++;
      logger.debug('Integration sync: campaign updated + snapshot written', {
        campaignId:  matched.id,
        name:        matched.name,
        externalId:  platformRecord.externalId,
        spend, clicks, impressions, conversions,
      });
    } catch (err) {
      logger.error('Integration sync: failed to persist campaign', {
        provider,
        externalId: platformRecord.externalId,
        name:       platformRecord.name,
        error:      err.message,
      });
    }
  }

  // ── 4. Invalidate analytics cache so dashboard reflects new data ─────────
  try {
    await AnalyticsAggregator.invalidateCache(teamId);
  } catch (err) {
    logger.warn('Integration sync: cache invalidation failed (non-fatal)', { error: err.message });
  }

  const avgRoas = roasValues.length
    ? parseFloat((roasValues.reduce((s, v) => s + v, 0) / roasValues.length).toFixed(2))
    : null;

  const result = {
    total:      platformCampaigns.length,
    synced,
    unmatched,
    snapshots,
    totalSpend: parseFloat(totalSpend.toFixed(2)),
    totalClicks,
    avgRoas,
    syncedAt:   new Date().toISOString(),
  };

  logger.info('Integration sync completed', { teamId, provider, ...result });
  return result;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateString(date) {
  return date.toISOString().split('T')[0]; // "YYYY-MM-DD"
}

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}
