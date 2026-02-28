'use strict';

const express    = require('express');
const { authenticate } = require('../middleware/auth');
const aggregator = require('../services/analytics/AnalyticsAggregator');
const { success } = require('../common/response');

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
    const data = await aggregator.getOverview(req.user.teamId);
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

module.exports = router;
