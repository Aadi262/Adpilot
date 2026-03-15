'use strict';

const express          = require('express');
const { authenticate } = require('../middleware/auth');
const aggregator       = require('../services/analytics/AnalyticsAggregator');
const situationReport  = require('../services/analytics/SituationReportService');
const { success }      = require('../common/response');

const router = express.Router();

router.use(authenticate);

/**
 * GET /api/v1/analytics/overview
 * Returns team-level KPIs: totalCampaigns, activeCampaigns, totalAdSpend,
 * totalRevenue, totalClicks, totalImpressions, totalConversions,
 * avgROAS, overallCPA, overallCTR, topCampaign.
 * Cached in Redis for 5 minutes.
 */
router.get('/overview', async (req, res, next) => {
  try {
    const range = ['7d', '30d', '90d'].includes(req.query.range) ? req.query.range : '30d';
    const data = await aggregator.getOverview(req.user.teamId, range);
    return success(res, data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/campaigns
 * Returns per-campaign performance with derived metrics:
 * roas, cpa, ctr, spend, revenue, clicks, impressions, conversions.
 */
router.get('/campaigns', async (req, res, next) => {
  try {
    const campaigns = await aggregator.getCampaignPerformance(req.user.teamId);
    return success(res, { campaigns });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/anomalies
 * Z-score anomaly detection across active campaigns.
 */
router.get('/anomalies', async (req, res, next) => {
  try {
    const anomalies = await aggregator.detectAnomalies(req.user.teamId);
    return success(res, { anomalies });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/time-series?range=7d|30d|90d
 * Daily spend/revenue/roas/clicks aggregated from CampaignMetricSnapshot.
 * Returns [] if no snapshots exist yet (no mock data).
 */
router.get('/time-series', async (req, res, next) => {
  try {
    const range = ['7d', '30d', '90d'].includes(req.query.range) ? req.query.range : '30d';
    const series = await aggregator.getTimeSeries(req.user.teamId, range);
    return success(res, { series, hasData: series.length > 0 });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/v1/analytics/snapshots
 * Manually record a metric snapshot for a campaign (for testing / manual entry).
 * Body: { campaignId, date, spend, revenue, roas, clicks, impressions, conversions, ctr, cpa }
 */
router.post('/snapshots', async (req, res, next) => {
  try {
    const { campaignId, date, spend = 0, revenue = 0, roas = 0, clicks = 0, impressions = 0, conversions = 0, ctr = 0, cpa, frequency, impressionShare, isLostBudget } = req.body;
    if (!campaignId || !date) {
      return res.status(400).json({ success: false, error: { message: 'campaignId and date required' } });
    }
    const prisma = require('../config/prisma');
    const snapshot = await prisma.campaignMetricSnapshot.upsert({
      where: { campaignId_date: { campaignId, date: new Date(date) } },
      update: { spend, revenue, roas, clicks, impressions, conversions, ctr, cpa, frequency, impressionShare, isLostBudget, source: 'manual' },
      create: { campaignId, teamId: req.user.teamId, date: new Date(date), spend, revenue, roas, clicks, impressions, conversions, ctr, cpa, frequency, impressionShare, isLostBudget, source: 'manual' },
    });
    await aggregator.invalidateCache(req.user.teamId);
    return success(res, { snapshot }, 201);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/v1/analytics/situation-report
 * Daily "morning briefing": urgent drops, active alerts, scale-ready winners, sentinel actions.
 * Pulls from CampaignMetricSnapshot day-over-day deltas — no mock data.
 */
router.get('/situation-report', async (req, res, next) => {
  try {
    const report = await situationReport.generate(req.user.teamId);
    return success(res, report);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
