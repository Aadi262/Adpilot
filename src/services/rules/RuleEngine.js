'use strict';

const prisma               = require('../../config/prisma');
const logger               = require('../../config/logger');
const AppError             = require('../../common/AppError');
const NotificationService  = require('../notifications/NotificationService');
const IntegrationService   = require('../integrations/IntegrationService');

// Strategy registry — OCP: add new triggers without touching this file
const STRATEGIES = new Map();
[
  require('./strategies/CpaStrategy'),
  require('./strategies/RoasStrategy'),
  require('./strategies/CtrStrategy'),
  require('./strategies/FrequencyStrategy'),
  require('./strategies/BudgetPacingStrategy'),
].forEach((s) => STRATEGIES.set(s.type, s));

const COOLDOWN_MINUTES = 60; // minimum gap between rule firings

// Map strategy action names to IntegrationService platform action names
const PLATFORM_ACTION_MAP = {
  pause_campaign:    'pause_campaign',
  reduce_budget_10:  'update_budget',
  reduce_budget_20:  'update_budget',
  increase_budget_10: 'update_budget',
};

class RuleEngine {
  /**
   * Evaluate all active rules for a given campaign.
   * Uses idempotency: will not re-fire within cooldown window.
   *
   * @param {string} campaignId
   * @param {object} metrics  — normalized { cpa, roas, ctr, frequency, spend, impressions }
   * @returns {Array<object>} — list of fired rule results
   */
  async evaluate(campaignId, metrics) {
    const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
    if (!campaign) throw AppError.notFound('Campaign');

    const rules = await prisma.rule.findMany({
      where: { campaignId, isActive: true },
    });

    const context = { campaign, metrics, teamId: campaign.teamId };
    const results = [];

    for (const rule of rules) {
      const result = await this._evaluateRule(rule, context);
      if (result) results.push(result);
    }

    return results;
  }

  async _evaluateRule(rule, context) {
    const strategy = STRATEGIES.get(rule.triggerType);
    if (!strategy) {
      logger.warn('No strategy for trigger type', { triggerType: rule.triggerType });
      return null;
    }

    // Idempotency / cooldown guard
    if (rule.lastTriggeredAt) {
      const elapsedMinutes = (Date.now() - new Date(rule.lastTriggeredAt).getTime()) / 60_000;
      if (elapsedMinutes < COOLDOWN_MINUTES) {
        logger.debug('Rule in cooldown', { ruleId: rule.id, elapsedMinutes });
        return null;
      }
    }

    let fires = false;
    try {
      fires = strategy.evaluate(rule, context);
    } catch (err) {
      logger.error('Strategy evaluate() threw', { ruleId: rule.id, error: err.message });
      return null;
    }

    if (!fires) return null;

    // Execute the action — produces { action, campaignUpdate, description, ... }
    const result = await strategy.execute(rule, context);

    // 1. Apply DB update + stamp rule in a single transaction
    await prisma.$transaction(async (tx) => {
      if (result.campaignUpdate && Object.keys(result.campaignUpdate).length) {
        await tx.campaign.update({ where: { id: context.campaign.id }, data: result.campaignUpdate });
      }
      await tx.rule.update({
        where: { id: rule.id },
        data:  { lastTriggeredAt: new Date() },
      });
    });

    logger.info('Rule fired', {
      ruleId:     rule.id,
      campaignId: context.campaign.id,
      action:     result.action,
      description: result.description,
    });

    // 2. Platform action — fire-and-forget, never blocks or rolls back the DB transaction
    this._callPlatformAction(result, context).catch((err) =>
      logger.error('Platform action error (non-fatal)', {
        ruleId:     rule.id,
        campaignId: context.campaign.id,
        error:      err.message,
      })
    );

    // 3. Notification — fire-and-forget
    NotificationService.create({
      teamId:     context.teamId,
      campaignId: context.campaign.id,
      type:       'rule_fired',
      channel:    'in_app',
      message:    result.description,
    }).catch((err) =>
      logger.error('Failed to create rule-fired notification', { ruleId: rule.id, error: err.message })
    );

    return { ruleId: rule.id, ...result };
  }

  /**
   * Attempt to mirror the rule action on the connected ad platform(s).
   *
   * Design decisions:
   *  - Never throws — all errors are caught and logged
   *  - Only acts if the campaign has a connected integration for that platform
   *  - Reads externalId from campaign.performance JSON (written by integrationSyncProcessor)
   *  - Campaigns with platform='both' attempt both Meta and Google in parallel
   *
   * @param {object} result  — from strategy.execute(): { action, campaignUpdate }
   * @param {object} context — { campaign, teamId }
   */
  async _callPlatformAction(result, context) {
    const { campaign, teamId } = context;
    const platformAction = PLATFORM_ACTION_MAP[result.action];

    // 'send_alert' and unmapped actions need no platform call
    if (!platformAction) {
      logger.debug('No platform action for rule action', { action: result.action });
      return;
    }

    const platforms = campaign.platform === 'both' ? ['meta', 'google'] : [campaign.platform];
    const perf      = campaign.performance || {};

    await Promise.allSettled(
      platforms.map((platform) => this._dispatchToPlatform(platform, platformAction, result, perf, teamId, campaign.id))
    );
  }

  async _dispatchToPlatform(platform, platformAction, result, perf, teamId, campaignId) {
    const externalIdKey       = `${platform}_campaign_id`;
    const budgetResourceKey   = `${platform}_budget_resource`;
    const externalCampaignId  = perf[externalIdKey];

    if (!externalCampaignId) {
      logger.info('No external campaign ID stored — skipping platform action', {
        platform,
        campaignId,
        platformAction,
        hint: `Run a ${platform} sync to populate ${externalIdKey}`,
      });
      return;
    }

    const params = { externalCampaignId };

    if (platformAction === 'update_budget') {
      const newBudget = result.campaignUpdate?.budget;
      if (newBudget === undefined) {
        logger.warn('update_budget action has no budget value in campaignUpdate', { campaignId, platform });
        return;
      }
      params.dailyBudget = Number(newBudget);
      // Google needs the budget resource name
      if (platform === 'google') {
        params.budgetResourceName = perf[budgetResourceKey] || null;
      }
    }

    const callResult = await IntegrationService.callCampaignAction(teamId, platform, platformAction, params);

    if (callResult) {
      logger.info('Platform action succeeded', { platform, platformAction, campaignId, externalCampaignId });
    }
  }

  /** Return all registered strategy types */
  static listTriggerTypes() {
    return [...STRATEGIES.keys()];
  }
}

module.exports = new RuleEngine();
