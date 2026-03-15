'use strict';

const prisma = require('../../config/prisma');

class ScalingAnalyzer {

  /**
   * Load the 7-day average performance from CampaignMetricSnapshot.
   * Returns merged perf object: snapshot 7-day averages take priority over campaign.performance JSON.
   */
  async _loadRealPerf(campaignId, storedPerf) {
    const since = new Date();
    since.setDate(since.getDate() - 7);

    const snapshots = await prisma.campaignMetricSnapshot.findMany({
      where:   { campaignId, date: { gte: since } },
      orderBy: { date: 'desc' },
      take:    7,
      select:  { spend: true, revenue: true, roas: true, clicks: true, impressions: true, conversions: true, ctr: true, cpa: true, frequency: true, impressionShare: true, isLostBudget: true },
    });

    if (snapshots.length === 0) return storedPerf;

    const avg = (arr, key) => {
      const vals = arr.map((s) => s[key]).filter((v) => v !== null && v !== undefined && v > 0);
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    return {
      ...storedPerf,
      spend:           snapshots.reduce((s, r) => s + (r.spend || 0), 0), // total spend over window
      revenue:         snapshots.reduce((s, r) => s + (r.revenue || 0), 0),
      roas:            avg(snapshots, 'roas'),
      ctr:             avg(snapshots, 'ctr'),
      cpa:             avg(snapshots, 'cpa'),
      clicks:          snapshots.reduce((s, r) => s + (r.clicks || 0), 0),
      impressions:     snapshots.reduce((s, r) => s + (r.impressions || 0), 0),
      conversions:     snapshots.reduce((s, r) => s + (r.conversions || 0), 0),
      frequency:       avg(snapshots, 'frequency') ?? storedPerf.frequency,
      impressionShare: avg(snapshots, 'impressionShare') ?? storedPerf.impressionShare,
      isLostBudget:    avg(snapshots, 'isLostBudget') ?? storedPerf.isLostBudget,
      _fromSnapshots:  true,
      _snapshotDays:   snapshots.length,
    };
  }

  // Score a single campaign for scaling readiness
  // Returns { score 0-100, verdict, factors, risks, recommendation, dataQuality }
  async analyze(campaignId, teamId) {
    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, teamId },
    });
    if (!campaign) return null;

    const storedPerf = campaign.performance ?? {};
    const perf       = await this._loadRealPerf(campaignId, storedPerf);
    const factors    = this._scoreFactors(campaign, perf);

    // Weighted average of all factors
    const totalWeight   = factors.reduce((s, f) => s + f.weight, 0);
    const weightedScore = factors.reduce((s, f) => s + (f.score * f.weight), 0);
    const score         = Math.round(weightedScore / totalWeight);

    const verdict = score >= 75 ? 'Ready to scale'
                  : score >= 55 ? 'Scale with caution'
                  : score >= 35 ? 'Needs improvement'
                  : 'Not ready';

    // Safe scale range based on score
    const safeScaleMin = score >= 75 ? 20 : score >= 55 ? 10 : 0;
    const safeScaleMax = score >= 75 ? 40 : score >= 55 ? 20 : 5;

    const risks          = this._identifyRisks(campaign, perf, factors);
    const recommendation = this._buildRecommendation(score, campaign, perf, safeScaleMin, safeScaleMax);

    return {
      campaignId,
      campaignName:   campaign.name,
      platform:       campaign.platform,
      budget:         campaign.budget ?? 0,   // needed for apply-scale mutation
      currentSpend:   perf.spend ?? 0,
      score,
      verdict,
      safeScaleRange: { min: safeScaleMin, max: safeScaleMax },
      factors: factors.map(f => ({
        name:   f.name,
        score:  f.score,
        weight: f.weight,
        impact: f.score >= 65 ? 'positive' : f.score >= 40 ? 'neutral' : 'negative',
        detail: f.detail,
      })),
      platformSignals: this._platformSignals(campaign, perf),
      risks,
      recommendation,
      dataQuality: this._assessDataQuality(perf),
      dataSource: perf._fromSnapshots
        ? { type: 'snapshots', days: perf._snapshotDays }
        : { type: 'performance_json', days: null },
    };
  }

  // Score all active campaigns for a team
  async analyzeAll(teamId) {
    const campaigns = await prisma.campaign.findMany({
      where:  { teamId, status: 'active' },
      select: { id: true },
    });

    const results = await Promise.all(
      campaigns.map(c => this.analyze(c.id, teamId))
    );

    return results.filter(Boolean).sort((a, b) => b.score - a.score);
  }

  _scoreFactors(campaign, perf) {
    const factors = [];
    const spend   = perf.spend  ?? 0;
    const roas    = perf.roas   ?? null;
    const ctr     = perf.ctr    ?? null;
    const cpa     = perf.cpa    ?? null;
    const budget  = campaign.budget ?? 0;

    // Factor 1: ROAS Health (weight: 30%)
    if (roas !== null) {
      const roasScore = roas >= 4.0 ? 95
                      : roas >= 3.0 ? 85
                      : roas >= 2.0 ? 70
                      : roas >= 1.5 ? 55
                      : roas >= 1.0 ? 35
                      : 10;
      factors.push({
        name:   'ROAS Health',
        score:  roasScore,
        weight: 30,
        detail: roas >= 3.0
          ? `Strong ROAS of ${roas.toFixed(1)}x — good foundation for scaling`
          : roas >= 1.5
          ? `Acceptable ROAS of ${roas.toFixed(1)}x — improve before aggressive scaling`
          : `ROAS of ${roas.toFixed(1)}x is too low — fix before scaling`,
      });
    } else {
      factors.push({
        name: 'ROAS Health', score: 30, weight: 30,
        detail: 'No ROAS data available — connect ad platform for accurate scoring',
      });
    }

    // Factor 2: CTR Quality (weight: 20%)
    if (ctr !== null) {
      const ctrScore = ctr >= 3.0 ? 90
                     : ctr >= 2.0 ? 78
                     : ctr >= 1.0 ? 62
                     : ctr >= 0.5 ? 45
                     : 20;
      factors.push({
        name:   'CTR Quality',
        score:  ctrScore,
        weight: 20,
        detail: ctr >= 2.0
          ? `CTR of ${ctr.toFixed(2)}% is strong — creative is resonating`
          : ctr >= 0.5
          ? `CTR of ${ctr.toFixed(2)}% is average — consider creative refresh`
          : `CTR of ${ctr.toFixed(2)}% is poor — creative needs work before scaling`,
      });
    }

    // Factor 3: Budget Utilization (weight: 20%)
    // High utilization = budget-constrained = ready to scale
    if (budget > 0 && spend > 0) {
      const utilization = (spend / budget) * 100;
      const utilScore   = utilization >= 85 ? 88
                        : utilization >= 60 ? 72
                        : utilization >= 40 ? 55
                        : 35;
      factors.push({
        name:   'Budget Utilization',
        score:  utilScore,
        weight: 20,
        detail: utilization >= 85
          ? `Using ${utilization.toFixed(0)}% of budget — campaign is budget-constrained, ready to scale`
          : `Using ${utilization.toFixed(0)}% of budget — room for optimization`,
      });
    }

    // Factor 4: CPA Efficiency (weight: 15%)
    if (cpa !== null) {
      const cpaScore = cpa <= 10  ? 90
                     : cpa <= 20  ? 78
                     : cpa <= 40  ? 62
                     : cpa <= 80  ? 45
                     : 25;
      factors.push({
        name:   'CPA Efficiency',
        score:  cpaScore,
        weight: 15,
        detail: `Cost per acquisition is ${cpa.toFixed(2)} — ${
          cpaScore >= 70 ? 'efficient' : cpaScore >= 50 ? 'acceptable' : 'high, watch closely when scaling'
        }`,
      });
    }

    // Factor 5: Data Volume (weight: 15%)
    const spendScore = spend >= 5000 ? 92
                     : spend >= 2000 ? 82
                     : spend >= 1000 ? 70
                     : spend >= 500  ? 55
                     : spend >= 100  ? 38
                     : 20;
    factors.push({
      name:   'Data Volume',
      score:  spendScore,
      weight: 15,
      detail: spend >= 1000
        ? `${spend.toFixed(0)} in spend — sufficient data for confident scaling decisions`
        : `Only ${spend.toFixed(0)} in spend — more data needed before scaling`,
    });

    return factors;
  }

  _identifyRisks(campaign, perf, factors) {
    const risks = [];
    const roas  = perf.roas  ?? null;
    const ctr   = perf.ctr   ?? null;
    const cpa   = perf.cpa   ?? null;
    const spend = perf.spend ?? 0;

    if (roas !== null && roas < 2.0) {
      risks.push('ROAS is below 2x — scaling will amplify losses if not improved first');
    }
    if (ctr !== null && ctr < 1.0) {
      risks.push('Low CTR means creative fatigue is likely — refresh ads before scaling');
    }
    if (cpa !== null && cpa > 50) {
      risks.push('High CPA may become unsustainable at scale — set a CPA cap');
    }
    if (spend < 500) {
      risks.push('Limited spend data — algorithm may not be fully optimized yet');
    }
    if (campaign.platform === 'Both') {
      risks.push('Cross-platform campaigns are harder to optimize — consider isolating platforms');
    }
    if (risks.length === 0) {
      risks.push('No major risks identified — monitor daily after scaling');
    }
    return risks;
  }

  _buildRecommendation(score, campaign, perf, min, max) {
    const roas = perf.roas ?? null;
    if (score >= 75) {
      return `Scale ${campaign.name} budget by ${min}–${max}% this week. ROAS is strong at ${roas?.toFixed(1) ?? 'N/A'}x. Monitor CPA daily — if it rises more than 20%, pause the scale.`;
    }
    if (score >= 55) {
      return `Proceed cautiously — scale by ${min}–${max}% maximum. Focus on improving CTR first. Run for 7 days before any further increases.`;
    }
    if (score >= 35) {
      return `Do not scale yet. Improve ROAS above 2x and CTR above 1% first. Re-evaluate in 14 days.`;
    }
    return `This campaign needs significant optimization before scaling. Consider pausing and rebuilding the creative strategy.`;
  }

  // Platform-specific scaling signals — Meta frequency & Google impression share
  _platformSignals(campaign, perf) {
    const signals = [];
    const platform = (campaign.platform || '').toLowerCase();
    const frequency = perf.frequency ?? null;
    const impressionShare = perf.impressionShare ?? perf.impression_share ?? null;
    const isLostBudget = perf.isLostBudget ?? perf.is_lost_budget ?? null;

    if (platform === 'meta' || platform === 'both') {
      if (frequency !== null) {
        const freqStatus = frequency > 3.5 ? 'critical'
                         : frequency > 2.5 ? 'warning'
                         : 'ok';
        signals.push({
          name:   'Audience Frequency (Meta)',
          value:  `${frequency.toFixed(1)}x`,
          status: freqStatus,
          detail: frequency > 3.5
            ? `Frequency ${frequency.toFixed(1)}x — audience fatigue likely. Rotate creative before scaling.`
            : frequency > 2.5
            ? `Frequency ${frequency.toFixed(1)}x — approaching fatigue threshold. Watch CTR trend.`
            : `Frequency ${frequency.toFixed(1)}x — healthy. Audience is not yet saturated.`,
        });
      } else {
        signals.push({
          name: 'Audience Frequency (Meta)', value: null, status: 'missing',
          detail: 'Frequency data unavailable — connect Meta integration to monitor audience saturation before scaling.',
        });
      }
    }

    if (platform === 'google' || platform === 'both') {
      if (impressionShare !== null) {
        const isStatus = impressionShare < 50 ? 'warning' : impressionShare < 80 ? 'ok' : 'positive';
        signals.push({
          name:   'Impression Share (Google)',
          value:  `${impressionShare.toFixed(0)}%`,
          status: isStatus,
          detail: impressionShare < 50
            ? `IS ${impressionShare.toFixed(0)}% — significant untapped volume available. Scaling budget will capture more impressions.`
            : `IS ${impressionShare.toFixed(0)}% — already capturing most available impressions. Scaling may have diminishing returns.`,
        });
      } else {
        signals.push({
          name: 'Impression Share (Google)', value: null, status: 'missing',
          detail: 'Impression share data unavailable — connect Google Ads API to see IS lost to budget before scaling.',
        });
      }

      if (isLostBudget !== null) {
        signals.push({
          name:   'IS Lost to Budget (Google)',
          value:  `${isLostBudget.toFixed(0)}%`,
          status: isLostBudget > 20 ? 'positive' : 'ok',
          detail: isLostBudget > 20
            ? `${isLostBudget.toFixed(0)}% of potential impressions lost to budget constraints — strong signal to scale.`
            : `Only ${isLostBudget.toFixed(0)}% lost to budget — other factors (Quality Score, bids) may be the real cap.`,
        });
      }
    }

    return signals;
  }

  _assessDataQuality(perf) {
    const fields    = ['roas', 'ctr', 'spend', 'cpa', 'clicks'];
    const available = fields.filter(f => perf[f] !== undefined && perf[f] !== null);
    const pct       = Math.round((available.length / fields.length) * 100);
    return {
      score:   pct,
      label:   pct >= 80 ? 'Good' : pct >= 60 ? 'Partial' : 'Limited',
      message: pct < 80
        ? 'Connect your ad platform for complete data and more accurate scoring'
        : 'Sufficient data for reliable scaling decisions',
    };
  }
}

module.exports = new ScalingAnalyzer();
