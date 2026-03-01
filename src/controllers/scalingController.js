'use strict';

const scalingPredictorService = require('../services/ai/ScalingPredictorService');
const { success }             = require('../common/response');
const AppError                 = require('../common/AppError');

// GET /api/v1/scaling/readiness?campaignId=X
exports.getCampaignReadiness = async (req, res, next) => {
  try {
    const { campaignId } = req.query;
    if (!campaignId) throw AppError.badRequest('campaignId query param is required');

    const result = await scalingPredictorService.predictScaleReadiness(campaignId, req.user.teamId);
    return success(res, result);
  } catch (err) {
    if (err.message === 'Campaign not found') return next(AppError.notFound('Campaign not found'));
    next(err);
  }
};

// GET /api/v1/scaling/all-campaigns
exports.getAllCampaignsReadiness = async (req, res, next) => {
  try {
    const campaigns = await scalingPredictorService.getAllCampaignsReadiness(req.user.teamId);
    return success(res, { campaigns });
  } catch (err) {
    next(err);
  }
};
