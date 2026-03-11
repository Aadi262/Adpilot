'use strict';

const MetricsCalculator = require('../analytics/MetricsCalculator');
const AnomalyDetector = require('../analytics/AnomalyDetector');

function toNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

class CampaignSignalService {
  buildCampaignDossier({ campaign, peerBaselines, teamTimezone, recentNotifications }) {
    const metrics = this._buildMetrics(campaign, teamTimezone);
    const dataGaps = this._buildDataGaps(campaign, metrics);
    const signals = this._buildSignals(campaign, metrics, peerBaselines);
    const health = this._buildHealth(signals, dataGaps);
    const recommendedActions = this._buildActions({ campaign, metrics, signals, dataGaps });
    const evidenceLog = this._buildEvidenceLog({ campaign, metrics, signals, recentNotifications });

    return {
      id: campaign.id,
      name: campaign.name,
      platform: campaign.platform,
      objective: campaign.objective,
      status: campaign.status,
      health,
      metrics,
      pacing: metrics.pacing,
      protectionState: {
        activeRules: (campaign.campaignAlerts || []).filter((rule) => rule.isActive).length,
        lastTriggeredAt: (campaign.campaignAlerts || [])
          .map((rule) => rule.triggeredAt)
          .filter(Boolean)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null,
        recentActions: recentNotifications.slice(0, 3).map((item) => ({
          type: item.type,
          message: item.message,
          createdAt: item.createdAt,
        })),
      },
      activeRules: (campaign.campaignAlerts || []).filter((rule) => rule.isActive).map((rule) => ({
        id: rule.id,
        alertType: rule.alertType,
        threshold: rule.threshold,
        action: rule.action,
        actionValue: rule.actionValue,
        triggeredAt: rule.triggeredAt,
      })),
      signals,
      recommendedActions,
      evidenceLog,
      dataGaps,
    };
  }

  summarize(dossiers) {
    const activeDossiers = dossiers.filter((item) => item.status === 'active');
    const critical = activeDossiers.filter((item) => item.health.level === 'critical');
    const warning = activeDossiers.filter((item) => item.health.level === 'warning');

    const totalSpend = activeDossiers.reduce((sum, item) => sum + item.metrics.spend, 0);
    const totalBudget = activeDossiers.reduce((sum, item) => sum + item.metrics.budget, 0);
    const atRiskBudget = activeDossiers
      .filter((item) => item.pacing.status === 'overspending' || item.health.level === 'critical')
      .reduce((sum, item) => sum + item.metrics.budget, 0);

    const topActions = activeDossiers
      .flatMap((item) => item.recommendedActions.map((action) => ({
        campaignId: item.id,
        campaignName: item.name,
        platform: item.platform,
        priority: action.priorityScore,
        label: action.label,
        reason: action.reason,
        automatable: action.automatable,
      })))
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 6);

    return {
      totalCampaigns: dossiers.length,
      activeCampaigns: activeDossiers.length,
      criticalCampaigns: critical.length,
      warningCampaigns: warning.length,
      protectedBudget: Number(Math.max(totalBudget - atRiskBudget, 0).toFixed(2)),
      atRiskBudget: Number(atRiskBudget.toFixed(2)),
      activeSpend: Number(totalSpend.toFixed(2)),
      utilization: totalBudget > 0 ? Number(((totalSpend / totalBudget) * 100).toFixed(1)) : 0,
      topActions,
    };
  }

  buildPeerBaselines(campaigns) {
    const activeCampaigns = campaigns.filter((campaign) => campaign.status === 'active');
    const metrics = {
      roas: [],
      ctr: [],
      cpa: [],
      spend: [],
      conversions: [],
    };

    activeCampaigns.forEach((campaign) => {
      const perf = campaign.performance || {};
      const spend = toNumber(perf.spend);
      const conversions = toNumber(perf.conversions);
      const clicks = toNumber(perf.clicks);
      const impressions = toNumber(perf.impressions);
      const ctr = perf.ctr != null ? toNumber(perf.ctr) : MetricsCalculator.ctr(clicks, impressions);
      const cpa = perf.cpa != null ? toNumber(perf.cpa) : MetricsCalculator.cpa(spend, conversions);
      const roas = perf.roas != null ? toNumber(perf.roas) : MetricsCalculator.roas(toNumber(perf.revenue), spend);

      if (roas > 0) metrics.roas.push(roas);
      if (ctr > 0) metrics.ctr.push(ctr);
      if (cpa > 0) metrics.cpa.push(cpa);
      if (spend > 0) metrics.spend.push(spend);
      if (conversions >= 0) metrics.conversions.push(conversions);
    });

    return metrics;
  }

  _buildMetrics(campaign, teamTimezone) {
    const perf = campaign.performance || {};
    const spend = toNumber(perf.spend);
    const revenue = toNumber(perf.revenue);
    const clicks = toNumber(perf.clicks);
    const impressions = toNumber(perf.impressions);
    const conversions = toNumber(perf.conversions);
    const roas = perf.roas != null ? toNumber(perf.roas) : MetricsCalculator.roas(revenue, spend);
    const ctr = perf.ctr != null ? toNumber(perf.ctr) : MetricsCalculator.ctr(clicks, impressions);
    const cpa = perf.cpa != null ? toNumber(perf.cpa) : MetricsCalculator.cpa(spend, conversions);
    const budget = toNumber(campaign.budget);
    const utilization = budget > 0 ? Number(((spend / budget) * 100).toFixed(1)) : 0;
    const projectedDailySpend = this._projectDailySpend(spend, teamTimezone);
    const paceDelta = budget > 0 ? Number((projectedDailySpend - budget).toFixed(2)) : 0;
    const velocity = this._dayProgress(teamTimezone) > 0 ? Number((spend / this._dayProgress(teamTimezone)).toFixed(2)) : spend;

    return {
      spend: Number(spend.toFixed(2)),
      revenue: Number(revenue.toFixed(2)),
      clicks,
      impressions,
      conversions,
      budget: Number(budget.toFixed(2)),
      utilization,
      roas: Number(roas.toFixed(2)),
      ctr: Number(ctr.toFixed(2)),
      cpa: Number(cpa.toFixed(2)),
      pacing: {
        projectedDailySpend: Number(projectedDailySpend.toFixed(2)),
        delta: paceDelta,
        status: budget > 0 && projectedDailySpend > budget * 1.1
          ? 'overspending'
          : budget > 0 && projectedDailySpend < budget * 0.6
          ? 'underspending'
          : 'on-pace',
        velocity,
      },
    };
  }

  _buildSignals(campaign, metrics, peerBaselines) {
    const signals = [];
    const addSignal = (signal) => signals.push({
      metric: signal.metric,
      severity: signal.severity,
      title: signal.title,
      reason: signal.reason,
      evidence: signal.evidence,
      source: signal.source || 'live_metrics',
    });

    if (campaign.status !== 'active') {
      addSignal({
        metric: 'status',
        severity: 'info',
        title: 'Campaign is not currently active',
        reason: `${campaign.name} is ${campaign.status}, so Sentinel is monitoring history but not active spend pacing.`,
        evidence: `${campaign.name} status=${campaign.status}`,
      });
      return signals;
    }

    if (metrics.roas > 0 && metrics.roas < 1) {
      addSignal({
        metric: 'roas',
        severity: 'critical',
        title: 'ROAS is below break-even',
        reason: `This campaign is returning ${metrics.roas}x on spend, which means it is not breaking even.`,
        evidence: `ROAS=${metrics.roas}x`,
      });
    } else if (metrics.roas > 0 && metrics.roas < 2) {
      addSignal({
        metric: 'roas',
        severity: 'warning',
        title: 'ROAS is below efficient range',
        reason: `ROAS is ${metrics.roas}x, which is weaker than a healthy scale-ready range for active acquisition.`,
        evidence: `ROAS=${metrics.roas}x`,
      });
    }

    if (metrics.ctr > 0 && metrics.ctr < 0.5) {
      addSignal({
        metric: 'ctr',
        severity: 'critical',
        title: 'CTR is critically low',
        reason: `CTR at ${metrics.ctr}% suggests the ad is failing to earn clicks at all.`,
        evidence: `CTR=${metrics.ctr}%`,
      });
    } else if (metrics.ctr > 0 && metrics.ctr < 1) {
      addSignal({
        metric: 'ctr',
        severity: 'warning',
        title: 'CTR is below healthy benchmark',
        reason: `CTR at ${metrics.ctr}% is weak enough to drag down delivery efficiency.`,
        evidence: `CTR=${metrics.ctr}%`,
      });
    }

    if (metrics.pacing.status === 'overspending') {
      addSignal({
        metric: 'budget',
        severity: metrics.pacing.delta > metrics.budget * 0.25 ? 'critical' : 'warning',
        title: 'Spend pacing is running hot',
        reason: `Projected daily spend is ${metrics.pacing.projectedDailySpend}, which is ${metrics.pacing.delta.toFixed(2)} above budget.`,
        evidence: `Budget=${metrics.budget}, projected=${metrics.pacing.projectedDailySpend}`,
      });
    } else if (metrics.pacing.status === 'underspending' && metrics.budget > 0) {
      addSignal({
        metric: 'budget',
        severity: 'info',
        title: 'Campaign is underspending budget',
        reason: `Projected daily spend is materially under budget, so delivery or audience size may be constrained.`,
        evidence: `Budget=${metrics.budget}, projected=${metrics.pacing.projectedDailySpend}`,
      });
    }

    if (metrics.spend > metrics.budget * 0.5 && metrics.conversions === 0 && metrics.budget > 0) {
      addSignal({
        metric: 'conversions',
        severity: 'warning',
        title: 'Spend is accumulating without conversions',
        reason: `The campaign has spent ${metrics.spend} without recorded conversions.`,
        evidence: `Spend=${metrics.spend}, conversions=${metrics.conversions}`,
      });
    }

    this._appendPeerSignals(signals, 'roas', metrics.roas, peerBaselines.roas, { lowIsBad: true, formatter: (v) => `${v}x` });
    this._appendPeerSignals(signals, 'ctr', metrics.ctr, peerBaselines.ctr, { lowIsBad: true, formatter: (v) => `${v}%` });
    this._appendPeerSignals(signals, 'cpa', metrics.cpa, peerBaselines.cpa, { lowIsBad: false, formatter: (v) => `${v}` });
    this._appendPeerSignals(signals, 'spend', metrics.spend, peerBaselines.spend, { lowIsBad: false, formatter: (v) => `${Math.round(v)}` });

    return signals;
  }

  _appendPeerSignals(signals, metric, value, baselineSeries, { lowIsBad, formatter }) {
    if (!value || !baselineSeries || baselineSeries.length < 3) return;

    const anomaly = AnomalyDetector.detect(value, baselineSeries, 1.35);
    if (!anomaly.isAnomaly) return;

    const severeDirection = lowIsBad ? 'drop' : 'spike';
    const severity = anomaly.direction === severeDirection && Math.abs(anomaly.zScore) > 2 ? 'critical' : 'warning';

    signals.push({
      metric,
      severity,
      title: `${metric.toUpperCase()} is an outlier versus peer campaigns`,
      reason: `Current ${metric} ${formatter(value)} is a ${anomaly.direction} versus the team baseline mean ${formatter(anomaly.mean)}.`,
      evidence: `${metric}=${formatter(value)} | baseline=${formatter(anomaly.mean)} | z=${anomaly.zScore}`,
      source: 'team_peer_baseline',
    });
  }

  _buildHealth(signals, dataGaps) {
    let score = 100;
    let level = 'healthy';

    signals.forEach((signal) => {
      if (signal.severity === 'critical') score -= 24;
      else if (signal.severity === 'warning') score -= 12;
      else score -= 4;
    });

    score -= Math.min(12, dataGaps.length * 3);
    score = Math.max(0, Math.min(100, score));

    if (signals.some((signal) => signal.severity === 'critical')) level = 'critical';
    else if (signals.some((signal) => signal.severity === 'warning')) level = 'warning';

    return {
      score,
      level,
      label: level === 'critical' ? 'At Risk' : level === 'warning' ? 'Needs Attention' : 'Stable',
    };
  }

  _buildActions({ campaign, metrics, signals, dataGaps }) {
    const actions = [];
    const pushAction = (action) => actions.push(action);

    if (signals.some((signal) => signal.metric === 'roas' && signal.severity === 'critical')) {
      pushAction({
        type: 'pause',
        label: 'Pause spend until ROAS recovers',
        reason: `ROAS is ${metrics.roas}x and the campaign is below break-even.`,
        automatable: true,
        priority: 'critical',
        priorityScore: 100,
      });
    }

    if (signals.some((signal) => signal.metric === 'budget' && signal.severity !== 'info')) {
      pushAction({
        type: 'reduce_budget',
        label: 'Trim daily budget by 20-30%',
        reason: `Projected spend is ${metrics.pacing.projectedDailySpend} against a budget of ${metrics.budget}.`,
        automatable: true,
        priority: 'high',
        priorityScore: 88,
      });
    }

    if (signals.some((signal) => signal.metric === 'ctr')) {
      pushAction({
        type: 'refresh_creative',
        label: 'Refresh headline, creative, or hook',
        reason: `CTR is ${metrics.ctr}%, so the campaign likely needs a stronger click trigger.`,
        automatable: false,
        priority: 'high',
        priorityScore: 76,
      });
    }

    if (signals.some((signal) => signal.metric === 'conversions')) {
      pushAction({
        type: 'check_tracking',
        label: 'Verify tracking and landing-page conversion path',
        reason: `Spend is accumulating with ${metrics.conversions} conversions recorded.`,
        automatable: false,
        priority: 'medium',
        priorityScore: 62,
      });
    }

    if (dataGaps.length > 0) {
      pushAction({
        type: 'fill_data_gap',
        label: 'Fill tracking gaps before scaling decisions',
        reason: dataGaps[0],
        automatable: false,
        priority: 'medium',
        priorityScore: 40,
      });
    }

    if (!actions.length && campaign.status === 'active') {
      pushAction({
        type: 'monitor',
        label: 'Keep campaign running and monitor',
        reason: 'No material pacing or efficiency issues were detected from current live metrics.',
        automatable: false,
        priority: 'low',
        priorityScore: 18,
      });
    }

    return actions;
  }

  _buildEvidenceLog({ campaign, metrics, signals, recentNotifications }) {
    const evidence = [
      `${campaign.name} spend is ${metrics.spend} against a ${metrics.budget} ${campaign.budgetType} budget.`,
      `Performance snapshot: ROAS ${metrics.roas}x, CTR ${metrics.ctr}%, CPA ${metrics.cpa}, conversions ${metrics.conversions}.`,
      `Spend pacing is ${metrics.pacing.status} with projected daily spend ${metrics.pacing.projectedDailySpend}.`,
    ];

    signals.slice(0, 3).forEach((signal) => {
      evidence.push(`${signal.title}: ${signal.reason}`);
    });

    recentNotifications.slice(0, 2).forEach((item) => {
      evidence.push(`Recent operator event: ${item.message}`);
    });

    return evidence;
  }

  _buildDataGaps(campaign, metrics) {
    const perf = campaign.performance || {};
    const dataGaps = [];

    if (perf.revenue == null && perf.roas == null) {
      dataGaps.push('Revenue or ROAS is missing, so profitability is inferred from partial performance data.');
    }
    if (perf.conversions == null) {
      dataGaps.push('Conversions are missing, so CPA and down-funnel efficiency may be understated.');
    }
    if (perf.impressions == null || perf.clicks == null) {
      dataGaps.push('Clicks or impressions are missing, so CTR quality is only partially observable.');
    }
    if (!campaign.startDate) {
      dataGaps.push('Campaign start date is missing, so pacing uses day-progress rather than campaign-lifetime velocity.');
    }
    if (metrics.budget === 0) {
      dataGaps.push('Budget is zero or missing, so budget pacing cannot be trusted.');
    }

    return dataGaps;
  }

  _projectDailySpend(spend, teamTimezone) {
    const progress = this._dayProgress(teamTimezone);
    if (progress <= 0) return spend;
    return spend / progress;
  }

  _dayProgress(timezone) {
    try {
      const now = new Date();
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone || 'UTC',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      });
      const parts = formatter.formatToParts(now);
      const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
      const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
      return Math.min(1, Math.max(0.05, (hour * 60 + minute) / 1440));
    } catch (_) {
      return 0.5;
    }
  }
}

module.exports = new CampaignSignalService();
