'use strict';

const budgetProtectionService = require('../services/ai/BudgetProtectionService');
const { success, created }    = require('../common/response');
const AppError                 = require('../common/AppError');

// GET /api/v1/budget-ai/alerts
exports.listAlerts = async (req, res, next) => {
  try {
    const alerts = await budgetProtectionService.getAlerts(req.user.teamId);
    return success(res, { alerts });
  } catch (err) {
    next(err);
  }
};

// POST /api/v1/budget-ai/alerts
exports.createAlert = async (req, res, next) => {
  try {
    const { campaignId, alertType, threshold, action, actionValue } = req.body;

    if (!campaignId || !alertType || threshold == null || !action) {
      throw AppError.badRequest('campaignId, alertType, threshold, and action are required');
    }

    const VALID_TYPES   = ['roas_drop', 'ctr_collapse', 'cpa_spike', 'budget_bleed'];
    const VALID_ACTIONS = ['pause', 'notify', 'reduce_budget'];

    if (!VALID_TYPES.includes(alertType)) {
      throw AppError.badRequest(`alertType must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (!VALID_ACTIONS.includes(action)) {
      throw AppError.badRequest(`action must be one of: ${VALID_ACTIONS.join(', ')}`);
    }

    const alert = await budgetProtectionService.createAlert(req.user.teamId, {
      campaignId, alertType, threshold, action, actionValue,
    });

    return created(res, { alert });
  } catch (err) {
    if (err.message === 'Campaign not found') return next(AppError.notFound('Campaign not found'));
    next(err);
  }
};

// PATCH /api/v1/budget-ai/alerts/:id
exports.updateAlert = async (req, res, next) => {
  try {
    const alert = await budgetProtectionService.updateAlert(req.user.teamId, req.params.id, req.body);
    return success(res, { alert });
  } catch (err) {
    if (err.message === 'Alert not found') return next(AppError.notFound('Alert not found'));
    next(err);
  }
};

// DELETE /api/v1/budget-ai/alerts/:id
exports.deleteAlert = async (req, res, next) => {
  try {
    await budgetProtectionService.deleteAlert(req.user.teamId, req.params.id);
    return res.status(204).end();
  } catch (err) {
    if (err.message === 'Alert not found') return next(AppError.notFound('Alert not found'));
    next(err);
  }
};

// GET /api/v1/budget-ai/scan
exports.scan = async (req, res, next) => {
  try {
    const result = await budgetProtectionService.scanTeam(req.user.teamId);
    return success(res, result);
  } catch (err) {
    next(err);
  }
};
