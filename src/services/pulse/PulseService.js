'use strict';

/**
 * PulseService — lightweight campaign health monitor.
 *
 * Without real ad-platform API keys, this service:
 *   1. Reads the performance snapshot already stored on each Campaign row.
 *   2. Evaluates it against team-configured alert rules (CampaignAlert table).
 *   3. Creates/updates Notification records (reuses existing table).
 *   4. Is clearly labelled demoMode=true when no platform key is present.
 *
 * When META_ACCESS_TOKEN or GOOGLE_ADS_DEVELOPER_TOKEN exist, extend
 * _fetchRealMetrics() to call those platforms.
 */

const prisma  = require('../../config/prisma');
const logger  = require('../../config/logger');

const CONNECTED = {
  meta:   !!process.env.META_ACCESS_TOKEN,
  google: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
  ga4:    !!process.env.GA4_MEASUREMENT_ID,
};

const demoMode = !CONNECTED.meta && !CONNECTED.google;

// ── Metric evaluation ─────────────────────────────────────────────────────────

function _evalMetrics(metrics, rules) {
  const triggered = [];

  for (const rule of rules) {
    if (!rule.isActive) continue;

    const { alertType, threshold } = rule;
    let fired = false;
    let detail = '';

    if (alertType === 'roas_drop' && metrics.roas !== null && metrics.roas < threshold) {
      fired  = true;
      detail = `ROAS is ${metrics.roas.toFixed(2)}x (threshold: ${threshold}x)`;
    } else if (alertType === 'ctr_collapse' && metrics.ctr !== null && metrics.ctr < threshold) {
      fired  = true;
      detail = `CTR is ${metrics.ctr.toFixed(2)}% (threshold: ${threshold}%)`;
    } else if (alertType === 'cpa_spike' && metrics.cpa !== null && metrics.cpa > threshold) {
      fired  = true;
      detail = `CPA is $${metrics.cpa.toFixed(2)} (threshold: $${threshold})`;
    } else if (alertType === 'spend_anomaly' && metrics.spend !== null && metrics.spend > threshold) {
      fired  = true;
      detail = `Daily spend $${metrics.spend.toFixed(2)} exceeds $${threshold}`;
    }

    if (fired) triggered.push({ rule, detail });
  }

  return triggered;
}

// ── Core scan ─────────────────────────────────────────────────────────────────

async function scan(teamId) {
  const campaigns = await prisma.campaign.findMany({
    where:   { teamId, deletedAt: null, status: { in: ['active', 'paused'] } },
    include: { campaignAlerts: { where: { isActive: true } } },
    take:    50,
  });

  const alerts = [];

  for (const campaign of campaigns) {
    const metrics = {
      roas:        campaign.performance?.roas   ?? null,
      ctr:         campaign.performance?.ctr    ?? null,
      cpa:         campaign.performance?.cpa    ?? null,
      spend:       campaign.performance?.spend  ?? null,
      impressions: campaign.performance?.impressions ?? null,
    };

    if (Object.values(metrics).every(v => v === null)) continue;

    const triggered = _evalMetrics(metrics, campaign.campaignAlerts);

    for (const { rule, detail } of triggered) {
      // Avoid duplicate notifications (cooldown: 1 hour per rule)
      const recent = await prisma.notification.findFirst({
        where: {
          teamId,
          message:   { contains: `[rule:${rule.id}]` },
          createdAt: { gte: new Date(Date.now() - 60 * 60 * 1000) },
        },
      });
      if (recent) continue;

      // Fetch a valid userId for this team (required field)
      const teamUser = await prisma.user.findFirst({ where: { teamId }, select: { id: true } });
      if (!teamUser) continue;

      const notif = await prisma.notification.create({
        data: {
          teamId,
          userId:  teamUser.id,
          type:    'ALERT',
          channel: 'in_app',
          message: `${rule.alertType.toUpperCase().replace('_', ' ')} on "${campaign.name}": ${detail} [rule:${rule.id}]`,
          status:  'pending',
        },
      });

      // Fire-and-forget: update rule triggeredAt
      prisma.campaignAlert.update({ where: { id: rule.id }, data: { triggeredAt: new Date() } })
        .catch(e => logger.error('PulseService: triggeredAt update failed', { err: e.message }));

      alerts.push({ notificationId: notif.id, campaign: campaign.name, detail, ruleType: rule.alertType });
    }
  }

  logger.info('PulseService.scan complete', { teamId, campaignCount: campaigns.length, alertsFired: alerts.length });
  return { demoMode, campaignsScanned: campaigns.length, alertsFired: alerts };
}

// ── Cron registration ─────────────────────────────────────────────────────────

let _cronStarted = false;

function startCron() {
  if (_cronStarted) return;
  _cronStarted = true;

  let cron;
  try { cron = require('node-cron'); } catch { return; }

  // Every 15 minutes: scan ALL teams
  cron.schedule('*/15 * * * *', async () => {
    try {
      const teams = await prisma.team.findMany({ select: { id: true }, take: 200 });
      for (const t of teams) {
        await scan(t.id).catch(e => logger.warn('PulseService cron: scan failed', { teamId: t.id, err: e.message }));
      }
    } catch (e) {
      logger.error('PulseService cron: team fetch failed', { err: e.message });
    }
  });

  logger.info('PulseService cron started (every 15 min)');
}

module.exports = { scan, startCron, demoMode: () => demoMode, connected: () => CONNECTED };
