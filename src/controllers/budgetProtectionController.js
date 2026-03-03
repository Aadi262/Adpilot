'use strict';

const prisma         = require('../config/prisma');
const BudgetGuardian = require('../services/budgetProtection/BudgetGuardian');
const AppError       = require('../common/AppError');
const { success, created } = require('../common/response');

// GET /api/v1/budget-ai/scan
exports.scan = async (req, res, next) => {
  try {
    const result = await BudgetGuardian.scan(req.user.teamId);
    return success(res, result);
  } catch (err) { next(err); }
};

// GET /api/v1/budget-ai/alerts
exports.listAlerts = async (req, res, next) => {
  try {
    const alerts = await prisma.campaignAlert.findMany({
      where:   { teamId: req.user.teamId },
      orderBy: { createdAt: 'desc' },
    });
    return success(res, { alerts });
  } catch (err) { next(err); }
};

// POST /api/v1/budget-ai/alerts
exports.createAlert = async (req, res, next) => {
  try {
    const { campaignId, alertType, threshold, action, actionValue } = req.body;

    if (!alertType || threshold === undefined || !action) {
      throw AppError.badRequest('alertType, threshold, and action are required');
    }

    const VALID_TYPES   = ['roas_drop', 'ctr_drop', 'cpa_spike', 'spend_limit'];
    const VALID_ACTIONS = ['pause', 'notify', 'reduce_budget'];

    if (!VALID_TYPES.includes(alertType)) {
      throw AppError.badRequest(`alertType must be one of: ${VALID_TYPES.join(', ')}`);
    }
    if (!VALID_ACTIONS.includes(action)) {
      throw AppError.badRequest(`action must be one of: ${VALID_ACTIONS.join(', ')}`);
    }

    const alert = await prisma.campaignAlert.create({
      data: {
        teamId:      req.user.teamId,
        campaignId:  campaignId ?? null,
        alertType,
        threshold:   parseFloat(threshold),
        action,
        actionValue: actionValue !== undefined ? parseFloat(actionValue) : null,
      },
    });

    return created(res, { alert });
  } catch (err) { next(err); }
};

// PATCH /api/v1/budget-ai/alerts/:id
exports.updateAlert = async (req, res, next) => {
  try {
    const existing = await prisma.campaignAlert.findFirst({
      where: { id: req.params.id, teamId: req.user.teamId },
    });
    if (!existing) throw AppError.notFound('Alert rule not found');

    const alert = await prisma.campaignAlert.update({
      where: { id: req.params.id },
      data:  {
        isActive:    req.body.isActive    ?? existing.isActive,
        threshold:   req.body.threshold   !== undefined
                       ? parseFloat(req.body.threshold)
                       : existing.threshold,
        action:      req.body.action      ?? existing.action,
        actionValue: req.body.actionValue !== undefined
                       ? parseFloat(req.body.actionValue)
                       : existing.actionValue,
      },
    });

    return success(res, { alert });
  } catch (err) { next(err); }
};

// DELETE /api/v1/budget-ai/alerts/:id
exports.deleteAlert = async (req, res, next) => {
  try {
    const existing = await prisma.campaignAlert.findFirst({
      where: { id: req.params.id, teamId: req.user.teamId },
    });
    if (!existing) throw AppError.notFound('Alert rule not found');

    await prisma.campaignAlert.delete({ where: { id: req.params.id } });
    return success(res, { deleted: true });
  } catch (err) { next(err); }
};

// GET /api/v1/budget-ai/campaign/:id
exports.analyzeCampaign = async (req, res, next) => {
  try {
    const result = await BudgetGuardian.analyzeCampaign(req.params.id, req.user.teamId);
    if (!result) throw AppError.notFound('Campaign not found');
    return success(res, result);
  } catch (err) { next(err); }
};

// POST /api/v1/budget-ai/apply-fix
// Body: { campaignId, action: 'pause' | 'reduce_budget' }
exports.applyFix = async (req, res, next) => {
  try {
    const { campaignId, action } = req.body;
    if (!campaignId || !action) throw AppError.badRequest('campaignId and action are required');

    const VALID_ACTIONS = ['pause', 'reduce_budget'];
    if (!VALID_ACTIONS.includes(action)) {
      throw AppError.badRequest(`action must be one of: ${VALID_ACTIONS.join(', ')}`);
    }

    const campaign = await prisma.campaign.findFirst({
      where: { id: campaignId, teamId: req.user.teamId },
    });
    if (!campaign) throw AppError.notFound('Campaign not found');

    let updateData = {};
    let message    = '';

    if (action === 'pause') {
      updateData = { status: 'paused' };
      message    = `Campaign "${campaign.name}" paused by Budget Protection AI`;
    } else if (action === 'reduce_budget') {
      const newBudget = Math.round((campaign.budget || 0) * 0.7);
      updateData = { budget: newBudget };
      message    = `Campaign "${campaign.name}" budget reduced to ₹${newBudget} (30% cut) by Budget Protection AI`;
    }

    const updated = await prisma.campaign.update({
      where: { id: campaignId },
      data:  updateData,
    });

    // Create a notification so the team knows what happened
    await prisma.notification.create({
      data: {
        teamId:  req.user.teamId,
        userId:  req.user.userId,
        type:    'budget_ai_action',
        title:   'Budget Protection Applied',
        message,
      },
    }).catch(() => {}); // non-blocking, ignore if notifications table missing fields

    return success(res, {
      campaignId,
      action,
      message,
      campaign: { id: updated.id, name: updated.name, status: updated.status, budget: updated.budget },
    });
  } catch (err) { next(err); }
};
