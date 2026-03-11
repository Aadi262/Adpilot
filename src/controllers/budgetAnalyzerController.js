'use strict';

const { success } = require('../common/response');
const liveCampaignAnalyzerService = require('../services/budgetProtection/LiveCampaignAnalyzerService');

exports.getAnalyzer = async (req, res, next) => {
  try {
    const force = req.query.force === '1';
    const analyzer = await liveCampaignAnalyzerService.getTeamAnalyzer(req.user.teamId, { force });
    return success(res, analyzer);
  } catch (err) {
    next(err);
  }
};
