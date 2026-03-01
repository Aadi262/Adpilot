'use strict';

/**
 * BudgetProtectionService — Phase D1
 *
 * Architecture:
 *   Bull queue: budgetMonitor (runs every 15 min via Bull repeat)
 *   For each active campaign: fetch latest metrics from Meta/Google Ads API
 *   Compare against thresholds stored in CampaignAlert model
 *   Triggers: ROAS < threshold, CTR drop > 30% vs 7d avg, CPA > 2x target
 *   Actions: pause campaign, send notification, reduce budget by X%
 *
 * DB models needed (added to schema.prisma — Phase D1 ✅):
 *   model CampaignAlert {
 *     id          String    @id @default(uuid())
 *     teamId      String
 *     campaignId  String
 *     alertType   String    // 'roas_drop' | 'ctr_collapse' | 'cpa_spike' | 'budget_bleed'
 *     threshold   Float
 *     action      String    // 'pause' | 'notify' | 'reduce_budget'
 *     actionValue Float?    // e.g. 20 for "reduce by 20%"
 *     isActive    Boolean   @default(true)
 *     triggeredAt DateTime?
 *     createdAt   DateTime  @default(now())
 *   }
 *
 * TODO Phase D1 (Real Implementation):
 *   - Install meta-business-sdk, google-ads-api packages
 *   - Implement fetchCampaignMetrics(campaignId, platform)
 *   - Implement evaluateThresholds(metrics, alerts) with real metric comparison
 *   - Implement executeAction(alert, campaign) — pause via platform API
 *   - Add Bull repeat job for budgetMonitor queue
 */

const prisma = require('../../config/prisma');
const createNotification = require('../notificationHelper');

class BudgetProtectionService {
  /**
   * Run a mock scan for all active campaigns of a team.
   * Returns realistic mock alerts based on campaign age and seeded performance data.
   * Phase D1: Replace with real metric fetch + threshold evaluation.
   */
  async scanTeam(teamId) {
    // Fetch active campaigns with their stored performance
    const campaigns = await prisma.campaign.findMany({
      where: { teamId, status: 'active', deletedAt: null },
      select: { id: true, name: true, platform: true, budget: true, performance: true, createdAt: true },
    });

    if (campaigns.length === 0) {
      return { alerts: [], status: 'healthy', scannedAt: new Date().toISOString() };
    }

    // Fetch alert rules
    const rules = await prisma.campaignAlert.findMany({
      where: { teamId, isActive: true },
    });

    const triggeredAlerts = [];

    for (const campaign of campaigns) {
      const perf = campaign.performance || {};
      const mockRoas = perf.roas ?? (2.0 + (campaign.id.charCodeAt(0) % 30) / 10);
      const mockCtr  = perf.ctr  ?? (1.5 + (campaign.id.charCodeAt(1) % 20) / 10);
      const mockCpa  = perf.cpa  ?? (25   + (campaign.id.charCodeAt(2) % 40));

      for (const rule of rules.filter((r) => r.campaignId === campaign.id)) {
        let triggered = false;
        let severity  = 'warning';
        let detail    = '';

        if (rule.alertType === 'roas_drop' && mockRoas < rule.threshold) {
          triggered = true;
          severity  = mockRoas < rule.threshold * 0.6 ? 'critical' : 'warning';
          detail    = `ROAS is ${mockRoas.toFixed(2)}x — below threshold of ${rule.threshold}x`;
        } else if (rule.alertType === 'ctr_collapse' && mockCtr < rule.threshold) {
          triggered = true;
          detail    = `CTR is ${mockCtr.toFixed(2)}% — below threshold of ${rule.threshold}%`;
        } else if (rule.alertType === 'cpa_spike' && mockCpa > rule.threshold) {
          triggered = true;
          severity  = mockCpa > rule.threshold * 1.5 ? 'critical' : 'warning';
          detail    = `CPA is $${mockCpa.toFixed(2)} — exceeds threshold of $${rule.threshold}`;
        } else if (rule.alertType === 'budget_bleed') {
          // Mock: flag if budget utilization would be > 95%
          const utilization = 0.75 + (campaign.id.charCodeAt(3) % 25) / 100;
          if (utilization > 0.95) {
            triggered = true;
            severity  = 'critical';
            detail    = `Budget utilization at ${(utilization * 100).toFixed(0)}% — potential overspend`;
          }
        }

        if (triggered) {
          triggeredAlerts.push({
            ruleId:       rule.id,
            campaignId:   campaign.id,
            campaignName: campaign.name,
            platform:     campaign.platform,
            alertType:    rule.alertType,
            threshold:    rule.threshold,
            action:       rule.action,
            severity,
            detail,
            recommendedAction: rule.action === 'pause'
              ? `Pause "${campaign.name}" campaign to stop wasted spend`
              : rule.action === 'reduce_budget'
              ? `Reduce budget by ${rule.actionValue ?? 20}%`
              : `Notify team about performance degradation`,
          });

          // Mark alert as triggered
          await prisma.campaignAlert.update({
            where: { id: rule.id },
            data:  { triggeredAt: new Date() },
          });
        }
      }
    }

    const criticalCount = triggeredAlerts.filter((a) => a.severity === 'critical').length;
    const status = criticalCount > 0 ? 'critical'
                 : triggeredAlerts.length > 0 ? 'warning'
                 : 'healthy';

    return {
      alerts:     triggeredAlerts,
      status,
      scannedAt:  new Date().toISOString(),
      campaignsScanned: campaigns.length,
    };
  }

  async createAlert(teamId, data) {
    const { campaignId, alertType, threshold, action, actionValue } = data;

    // Validate campaign belongs to team
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, teamId, deletedAt: null },
    });
    if (!campaign) throw new Error('Campaign not found');

    return prisma.campaignAlert.create({
      data: {
        teamId,
        campaignId,
        alertType,
        threshold: parseFloat(threshold),
        action,
        actionValue: actionValue != null ? parseFloat(actionValue) : null,
        isActive: true,
      },
    });
  }

  async getAlerts(teamId) {
    return prisma.campaignAlert.findMany({
      where:   { teamId },
      include: { campaign: { select: { name: true, platform: true, status: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateAlert(teamId, alertId, data) {
    const existing = await prisma.campaignAlert.findFirst({ where: { id: alertId, teamId } });
    if (!existing) throw new Error('Alert not found');

    const updateData = {};
    if (data.threshold   != null) updateData.threshold   = parseFloat(data.threshold);
    if (data.action      != null) updateData.action      = data.action;
    if (data.actionValue != null) updateData.actionValue = parseFloat(data.actionValue);
    if (data.isActive    != null) updateData.isActive    = Boolean(data.isActive);

    return prisma.campaignAlert.update({ where: { id: alertId }, data: updateData });
  }

  async deleteAlert(teamId, alertId) {
    const existing = await prisma.campaignAlert.findFirst({ where: { id: alertId, teamId } });
    if (!existing) throw new Error('Alert not found');
    await prisma.campaignAlert.delete({ where: { id: alertId } });
  }
}

module.exports = new BudgetProtectionService();
