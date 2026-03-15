'use strict';

const prisma  = require('../../config/prisma');
const logger  = require('../../config/logger');

// Thresholds for automatic detection
const DEFAULTS = {
  roasDrop:        0.20,  // 20% drop triggers warning
  roasCrash:       0.40,  // 40% drop triggers critical
  ctrDrop:         0.25,  // 25% CTR drop triggers warning
  cpaSpike:        0.30,  // 30% CPA increase triggers warning
  spendOverBudget: 0.10,  // 10% over daily budget triggers warning
  minSpend:        10,    // ignore campaigns with < $10 spend
};

class BudgetGuardian {

  // Analyze all active campaigns for a team
  // Returns { status, alerts, campaignCount, scannedAt }
  async scan(teamId) {
    const campaigns = await prisma.campaign.findMany({
      where:  { teamId, status: 'active' },
      select: {
        id: true, name: true, platform: true,
        budget: true, budgetType: true,
        performance: true,
      },
    });

    // Load ALL active rules for the team once — avoids N+1 query inside campaign loop
    const allRules = await prisma.campaignAlert.findMany({
      where: { teamId, isActive: true },
    });

    const alerts = [];
    let totalSpend = 0;
    let totalBudget = 0;
    let totalConversions = 0;
    let totalRevenue = 0;
    const campaignSummaries = [];

    for (const campaign of campaigns) {
      const perf  = campaign.performance ?? {};
      const spend = perf.spend ?? 0;
      const conversions = perf.conversions ?? 0;
      const revenue = perf.revenue ?? 0;
      const ctr = perf.ctr ?? null;
      const cpa = perf.cpa ?? null;
      totalSpend += Number(spend) || 0;
      totalBudget += Number(campaign.budget) || 0;
      totalConversions += Number(conversions) || 0;
      totalRevenue += Number(revenue) || 0;
      campaignSummaries.push({
        id: campaign.id,
        name: campaign.name,
        platform: campaign.platform,
        status: campaign.status,
        spend: Number(spend) || 0,
        budget: Number(campaign.budget) || 0,
        ctr,
        cpa,
        roas: perf.roas ?? null,
      });

      // Skip campaigns with no meaningful spend
      if (spend < DEFAULTS.minSpend) continue;

      // Filter pre-loaded rules for this campaign (campaign-specific or global)
      const rules = allRules.filter(
        (r) => r.campaignId === campaign.id || r.campaignId === null
      );

      // Evaluate each rule against real data
      for (const rule of rules) {
        const triggered = this._evaluateRule(rule, perf);
        if (triggered) {
          alerts.push({
            ruleId:       rule.id,
            campaignId:   campaign.id,
            campaignName: campaign.name,
            platform:     campaign.platform,
            alertType:    rule.alertType,
            severity:     this._getSeverity(rule.alertType, triggered),
            message:      this._buildMessage(rule, campaign, perf, triggered),
            currentValue: triggered.currentValue,
            threshold:    rule.threshold,
            action:       rule.action,
          });

          // Record trigger timestamp (non-blocking)
          prisma.campaignAlert.update({
            where: { id: rule.id },
            data:  { triggeredAt: new Date() },
          }).catch(() => {});
        }
      }

      // Auto-detect issues even without explicit rules
      const autoAlerts = this._autoDetect(campaign, perf);
      alerts.push(...autoAlerts);
    }

    const spendVelocity = totalBudget > 0 ? Number(((totalSpend / totalBudget) * 100).toFixed(1)) : 0;
    const blendedCpa = totalConversions > 0 ? Number((totalSpend / totalConversions).toFixed(2)) : null;
    const blendedRoas = totalSpend > 0 ? Number((totalRevenue / totalSpend).toFixed(2)) : null;
    const anomalies = campaignSummaries
      .filter((c) => (c.ctr !== null && c.ctr < 0.5) || (c.spend > c.budget && c.budget > 0))
      .map((c) => ({
        campaignId: c.id,
        campaignName: c.name,
        message: c.ctr !== null && c.ctr < 0.5
          ? `CTR critically low (${c.ctr?.toFixed(2)}%) on ${c.name} — creative may need refresh`
          : `Spend exceeded daily budget on ${c.name}`,
      }))
      .slice(0, 5);

    return {
      status:        alerts.some(a => a.severity === 'critical')
                       ? 'critical'
                       : alerts.length > 0 ? 'warning' : 'healthy',
      alerts,
      summary: {
        dailySpend: totalSpend,
        dailyBudget: totalBudget,
        // Run-rate projections: today's spend × days (not real forecasts)
        weeklyRunRate:  Number((totalSpend * 7).toFixed(2)),
        monthlyRunRate: Number((totalSpend * 30).toFixed(2)),
        // Keep legacy keys for backward compat with export report
        weeklySpend:  Number((totalSpend * 7).toFixed(2)),
        monthlySpend: Number((totalSpend * 30).toFixed(2)),
        spendVelocity,
        blendedCpa,
        blendedRoas,
      },
      anomalies,
      campaigns: campaignSummaries,
      campaignCount: campaigns.length,
      scannedAt:     new Date().toISOString(),
    };
  }

  // Evaluate a single rule against campaign performance
  _evaluateRule(rule, perf) {
    const { alertType, threshold } = rule;

    switch (alertType) {
      case 'roas_drop': {
        const roas = perf.roas ?? null;
        if (roas === null) return null;
        if (roas < threshold) {
          return { currentValue: roas, delta: threshold - roas };
        }
        return null;
      }
      case 'ctr_drop':
      case 'ctr_collapse': {
        const ctr = perf.ctr ?? null;
        if (ctr === null) return null;
        if (ctr < threshold) {
          return { currentValue: ctr, delta: threshold - ctr };
        }
        return null;
      }
      case 'cpa_spike': {
        const cpa = perf.cpa ?? null;
        if (cpa === null) return null;
        if (cpa > threshold) {
          return { currentValue: cpa, delta: cpa - threshold };
        }
        return null;
      }
      case 'spend_limit':
      case 'budget_bleed': {
        const spend = perf.spend ?? 0;
        if (spend > threshold) {
          return { currentValue: spend, delta: spend - threshold };
        }
        return null;
      }
      default:
        return null;
    }
  }

  // Auto-detect obvious problems without explicit rules
  _autoDetect(campaign, perf) {
    const alerts = [];
    const { roas, ctr, cpa } = perf;
    const spend  = perf.spend ?? 0;
    const budget = campaign.budget ?? 0;

    // ROAS below 1.0 = losing money
    if (roas !== undefined && roas !== null && roas < 1.0 && spend > 50) {
      alerts.push({
        campaignId:   campaign.id,
        campaignName: campaign.name,
        platform:     campaign.platform,
        alertType:    'roas_below_breakeven',
        severity:     'critical',
        message:      `${campaign.name} is losing money — ROAS is ${roas.toFixed(2)}x (below break-even of 1.0x)`,
        currentValue: roas,
        threshold:    1.0,
        action:       'notify',
        autoDetected: true,
      });
    }

    // CTR below 0.5% is very poor
    if (ctr !== undefined && ctr !== null && ctr < 0.5 && spend > 30) {
      alerts.push({
        campaignId:   campaign.id,
        campaignName: campaign.name,
        platform:     campaign.platform,
        alertType:    'ctr_critical',
        severity:     'warning',
        message:      `${campaign.name} has critically low CTR of ${ctr.toFixed(2)}% — creative may need refreshing`,
        currentValue: ctr,
        threshold:    0.5,
        action:       'notify',
        autoDetected: true,
      });
    }

    // Spend exceeding daily budget by >10%
    if (budget > 0 && spend > budget * 1.1) {
      alerts.push({
        campaignId:   campaign.id,
        campaignName: campaign.name,
        platform:     campaign.platform,
        alertType:    'budget_exceeded',
        severity:     'warning',
        message:      `${campaign.name} has exceeded daily budget — spent ${spend.toFixed(0)} vs ${budget} limit`,
        currentValue: spend,
        threshold:    budget,
        action:       'notify',
        autoDetected: true,
      });
    }

    return alerts;
  }

  _getSeverity(alertType, triggered) {
    if (alertType === 'roas_drop' && triggered.currentValue < 1.0) return 'critical';
    return 'warning';
  }

  _buildMessage(rule, campaign, perf, triggered) {
    const val = triggered.currentValue;
    switch (rule.alertType) {
      case 'roas_drop':
        return `${campaign.name} ROAS dropped to ${val.toFixed(2)}x — below your threshold of ${rule.threshold}x`;
      case 'ctr_drop':
      case 'ctr_collapse':
        return `${campaign.name} CTR fell to ${val.toFixed(2)}% — below your threshold of ${rule.threshold}%`;
      case 'cpa_spike':
        return `${campaign.name} CPA spiked to ${val.toFixed(2)} — above your limit of ${rule.threshold}`;
      case 'spend_limit':
      case 'budget_bleed':
        return `${campaign.name} spend reached ${val.toFixed(0)} — above your limit of ${rule.threshold}`;
      default:
        return `${campaign.name} triggered ${rule.alertType} alert`;
    }
  }

  // Get analysis for a single campaign (for detail view)
  async analyzeCampaign(campaignId, teamId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, teamId },
    });
    if (!campaign) return null;

    const perf   = campaign.performance ?? {};
    const alerts = this._autoDetect(campaign, perf);

    const rules = await prisma.campaignAlert.findMany({
      where: {
        teamId,
        isActive: true,
        OR: [{ campaignId }, { campaignId: null }],
      },
    });

    for (const rule of rules) {
      const triggered = this._evaluateRule(rule, perf);
      if (triggered) {
        alerts.push({
          ruleId:       rule.id,
          alertType:    rule.alertType,
          severity:     this._getSeverity(rule.alertType, triggered),
          message:      this._buildMessage(rule, campaign, perf, triggered),
          currentValue: triggered.currentValue,
          threshold:    rule.threshold,
          action:       rule.action,
        });
      }
    }

    return {
      campaignId,
      campaignName: campaign.name,
      platform:     campaign.platform,
      status:       campaign.status,
      performance:  perf,
      alerts,
      health:       alerts.some(a => a.severity === 'critical')
                      ? 'critical'
                      : alerts.length > 0 ? 'warning' : 'healthy',
    };
  }
}

module.exports = new BudgetGuardian();
