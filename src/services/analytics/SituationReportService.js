'use strict';

const prisma          = require('../../config/prisma');
const ScalingAnalyzer = require('../scaling/ScalingAnalyzer');
const logger          = require('../../config/logger');

/**
 * Generates the daily "Situation Report" — what changed overnight, what to act on.
 * Reads from CampaignMetricSnapshot for real deltas. Falls back gracefully if no snapshots.
 */
class SituationReportService {

  async generate(teamId) {
    const [urgent, watch, winners, sentinelActions] = await Promise.all([
      this._findUrgent(teamId),
      this._findWatch(teamId),
      this._findWinners(teamId),
      this._findSentinelActions(teamId),
    ]);

    const generatedAt  = new Date().toISOString();
    const hasRealData  = urgent.length > 0 || winners.length > 0 || sentinelActions.length > 0;

    return {
      generatedAt,
      hasRealData,
      urgent,
      watch,
      winners,
      sentinelActions,
      totalItems: urgent.length + watch.length + winners.length,
    };
  }

  // Campaigns where ROAS or CTR dropped >20% day-over-day
  async _findUrgent(teamId) {
    const items = [];

    try {
      const today     = new Date(); today.setUTCHours(0, 0, 0, 0);
      const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
      const dayBefore = new Date(today); dayBefore.setDate(dayBefore.getDate() - 2);

      // Get snapshots for yesterday and day-before for all team campaigns
      const [yday, dBefore] = await Promise.all([
        prisma.campaignMetricSnapshot.findMany({
          where:   { teamId, date: { gte: yesterday, lt: today } },
          select:  { campaignId: true, roas: true, ctr: true, spend: true, cpa: true },
        }),
        prisma.campaignMetricSnapshot.findMany({
          where:   { teamId, date: { gte: dayBefore, lt: yesterday } },
          select:  { campaignId: true, roas: true, ctr: true, spend: true, cpa: true },
        }),
      ]);

      if (!yday.length || !dBefore.length) return items;

      // Build lookup for day-before
      const prevByCamera = new Map(dBefore.map((s) => [s.campaignId, s]));

      // Load campaign names in one query
      const campaignIds = yday.map((s) => s.campaignId);
      const campaigns   = await prisma.campaign.findMany({
        where:  { id: { in: campaignIds }, teamId },
        select: { id: true, name: true, platform: true, budget: true },
      });
      const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

      for (const curr of yday) {
        const prev     = prevByCamera.get(curr.campaignId);
        const campaign = campaignMap.get(curr.campaignId);
        if (!prev || !campaign) continue;

        // ROAS drop > 30%
        if (prev.roas > 0 && curr.roas > 0) {
          const roasDrop = (prev.roas - curr.roas) / prev.roas;
          if (roasDrop >= 0.3) {
            items.push({
              type:       'roas_drop',
              severity:   roasDrop >= 0.5 ? 'critical' : 'high',
              campaignId: curr.campaignId,
              campaign:   campaign.name,
              platform:   campaign.platform,
              metric:     'ROAS',
              current:    parseFloat(curr.roas.toFixed(2)),
              previous:   parseFloat(prev.roas.toFixed(2)),
              changePct:  -Math.round(roasDrop * 100),
              spend:      parseFloat(curr.spend.toFixed(2)),
              action:     'Pause or refresh creative',
              actionLink: `/campaigns`,
            });
          }
        }

        // CTR collapse > 30%
        if (prev.ctr > 0 && curr.ctr > 0) {
          const ctrDrop = (prev.ctr - curr.ctr) / prev.ctr;
          if (ctrDrop >= 0.3) {
            items.push({
              type:       'ctr_collapse',
              severity:   'high',
              campaignId: curr.campaignId,
              campaign:   campaign.name,
              platform:   campaign.platform,
              metric:     'CTR',
              current:    parseFloat(curr.ctr.toFixed(2)),
              previous:   parseFloat(prev.ctr.toFixed(2)),
              changePct:  -Math.round(ctrDrop * 100),
              spend:      parseFloat(curr.spend.toFixed(2)),
              action:     'Refresh ad creative',
              actionLink: `/ads`,
            });
          }
        }

        // CPA spike > 40%
        if (prev.cpa && prev.cpa > 0 && curr.cpa && curr.cpa > 0) {
          const cpaSpike = (curr.cpa - prev.cpa) / prev.cpa;
          if (cpaSpike >= 0.4) {
            items.push({
              type:       'cpa_spike',
              severity:   'high',
              campaignId: curr.campaignId,
              campaign:   campaign.name,
              platform:   campaign.platform,
              metric:     'CPA',
              current:    parseFloat(curr.cpa.toFixed(2)),
              previous:   parseFloat(prev.cpa.toFixed(2)),
              changePct:  Math.round(cpaSpike * 100),
              spend:      parseFloat(curr.spend.toFixed(2)),
              action:     'Review audience and bid strategy',
              actionLink: `/campaigns`,
            });
          }
        }
      }
    } catch (err) {
      logger.warn('SituationReport._findUrgent failed', { error: err.message });
    }

    // Sort by severity: critical first
    return items.sort((a, b) => (a.severity === 'critical' ? -1 : 1));
  }

  // Budget over-pace alerts from CampaignAlert model (triggered in last 24h)
  async _findWatch(teamId) {
    const items = [];
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const alerts = await prisma.campaignAlert.findMany({
        where:  { teamId, triggeredAt: { gte: since }, isActive: true },
        select: { id: true, alertType: true, campaignId: true, threshold: true, action: true, triggeredAt: true },
        take:   5,
      });

      const campaignIds = [...new Set(alerts.map((a) => a.campaignId).filter(Boolean))];
      const campaigns   = campaignIds.length
        ? await prisma.campaign.findMany({ where: { id: { in: campaignIds } }, select: { id: true, name: true } })
        : [];
      const campaignMap = new Map(campaigns.map((c) => [c.id, c]));

      for (const a of alerts) {
        const campaign = a.campaignId ? campaignMap.get(a.campaignId) : null;
        items.push({
          type:      a.alertType,
          campaign:  campaign?.name || 'Team-wide rule',
          threshold: a.threshold,
          action:    a.action,
          triggeredAt: a.triggeredAt?.toISOString(),
        });
      }
    } catch (err) {
      logger.warn('SituationReport._findWatch failed', { error: err.message });
    }
    return items;
  }

  // Campaigns with Apex score ≥ 75 (ready to scale)
  async _findWinners(teamId) {
    const items = [];
    try {
      const all = await ScalingAnalyzer.analyzeAll(teamId);
      for (const c of all) {
        if (c.score >= 75) {
          items.push({
            campaignId:    c.campaignId,
            campaign:      c.campaignName,
            platform:      c.platform,
            score:         c.score,
            verdict:       c.verdict,
            budget:        Number(c.budget),
            roas:          c.factors.find((f) => f.name === 'ROAS Health')?.detail,
            recommendation: c.recommendation,
            safeScaleRange: c.safeScaleRange,
            actionLink:    `/scaling`,
          });
        }
      }
    } catch (err) {
      logger.warn('SituationReport._findWinners failed', { error: err.message });
    }
    return items.slice(0, 3); // top 3 winners
  }

  // Sentinel auto-actions taken in last 24h (budget pauses/reductions)
  async _findSentinelActions(teamId) {
    const items = [];
    try {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

      // Look for notifications from sentinel actions
      const notifs = await prisma.notification.findMany({
        where: {
          teamId,
          createdAt: { gte: since },
          type:      { in: ['campaign_paused', 'budget_reduced', 'sentinel_action'] },
        },
        orderBy: { createdAt: 'desc' },
        take:    5,
        select:  { message: true, createdAt: true, campaignId: true, type: true },
      });

      for (const n of notifs) {
        items.push({
          message:   n.message,
          type:      n.type,
          takenAt:   n.createdAt.toISOString(),
          campaignId: n.campaignId,
        });
      }
    } catch (err) {
      logger.warn('SituationReport._findSentinelActions failed', { error: err.message });
    }
    return items;
  }
}

module.exports = new SituationReportService();
