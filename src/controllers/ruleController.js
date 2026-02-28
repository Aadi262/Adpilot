'use strict';

const prisma      = require('../config/prisma');
const RuleEngine  = require('../services/rules/RuleEngine');
const { queues }  = require('../queues');
const { success, created, paginated } = require('../common/response');
const { parsePagination } = require('../common/pagination');
const AppError    = require('../common/AppError');

exports.listRules = async (req, res, next) => {
  try {
    const { page, limit, skip } = parsePagination(req.query);
    const where = { teamId: req.user.teamId };
    if (req.query.campaignId) where.campaignId = req.query.campaignId;

    const [items, total] = await Promise.all([
      prisma.rule.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.rule.count({ where }),
    ]);
    return paginated(res, items, total, page, limit);
  } catch (err) { next(err); }
};

exports.createRule = async (req, res, next) => {
  try {
    const { campaignId, triggerType, triggerValue, action, actionValue } = req.body;

    // Validate trigger type
    const validTypes = RuleEngine.constructor.listTriggerTypes
      ? RuleEngine.constructor.listTriggerTypes()
      : ['cpa_exceeds', 'roas_below', 'ctr_below', 'frequency_high', 'budget_pacing_anomaly'];

    if (!validTypes.includes(triggerType)) {
      throw AppError.badRequest(`Invalid triggerType. Valid: ${validTypes.join(', ')}`);
    }

    if (campaignId) {
      const campaign = await prisma.campaign.findFirst({ where: { id: campaignId, teamId: req.user.teamId } });
      if (!campaign) throw AppError.notFound('Campaign');
    }

    const rule = await prisma.rule.create({
      data: { teamId: req.user.teamId, campaignId: campaignId || null, triggerType, triggerValue, action, actionValue: actionValue || null },
    });
    return created(res, { rule });
  } catch (err) { next(err); }
};

exports.updateRule = async (req, res, next) => {
  try {
    const rule = await prisma.rule.findFirst({ where: { id: req.params.id, teamId: req.user.teamId } });
    if (!rule) throw AppError.notFound('Rule');

    // Whitelist mutable fields — never let req.body reach Prisma directly
    const { triggerType, triggerValue, action, actionValue, isActive } = req.body;
    const data = {};
    if (triggerType  !== undefined) data.triggerType  = triggerType;
    if (triggerValue !== undefined) data.triggerValue = triggerValue;
    if (action       !== undefined) data.action       = action;
    if (actionValue  !== undefined) data.actionValue  = actionValue;
    if (isActive     !== undefined) data.isActive     = isActive;

    if (!Object.keys(data).length) throw AppError.badRequest('No valid fields to update');

    const updated = await prisma.rule.update({ where: { id: req.params.id }, data });
    return success(res, { rule: updated });
  } catch (err) { next(err); }
};

exports.deleteRule = async (req, res, next) => {
  try {
    const rule = await prisma.rule.findFirst({ where: { id: req.params.id, teamId: req.user.teamId } });
    if (!rule) throw AppError.notFound('Rule');
    await prisma.rule.delete({ where: { id: req.params.id } });
    return success(res, { message: 'Rule deleted' });
  } catch (err) { next(err); }
};

exports.triggerEvaluation = async (req, res, next) => {
  try {
    const job = await queues.ruleEvaluation.add({ teamId: req.user.teamId, campaignId: req.query.campaignId });
    return success(res, { jobId: job.id, message: 'Rule evaluation queued' });
  } catch (err) { next(err); }
};

exports.listTriggerTypes = async (req, res, next) => {
  try {
    return success(res, { types: RuleEngine.constructor.listTriggerTypes() });
  } catch (err) { next(err); }
};
