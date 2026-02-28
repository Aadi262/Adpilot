'use strict';

const integrationService = require('../services/integrations/IntegrationService');
const { queues }         = require('../queues');
const { success, created } = require('../common/response');

exports.listProviders = async (req, res, next) => {
  try {
    const providers  = integrationService.constructor.listProviders();
    const connected  = await integrationService.listIntegrations(req.user.teamId);
    const connectedSet = new Set(connected.map((i) => i.provider));

    return success(res, {
      providers: providers.map((p) => ({ provider: p, connected: connectedSet.has(p) })),
      integrations: connected,
    });
  } catch (err) { next(err); }
};

exports.connect = async (req, res, next) => {
  try {
    const { provider } = req.params;
    // accountId: Meta ad account ID (e.g. "1234567890") or Google customer ID
    const { code, redirectUri, accountId } = req.body;
    const integration = await integrationService.connect(req.user.teamId, provider, code, redirectUri, accountId);
    return created(res, { integration });
  } catch (err) { next(err); }
};

exports.disconnect = async (req, res, next) => {
  try {
    await integrationService.disconnect(req.user.teamId, req.params.provider);
    return success(res, { message: `${req.params.provider} integration disconnected` });
  } catch (err) { next(err); }
};

exports.syncData = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const { dateFrom, dateTo } = req.body;

    // Enqueue the sync job — processor handles fetching + persisting to campaigns.performance
    const job = await queues.integrationSync.add({
      teamId:   req.user.teamId,
      provider,
      dateFrom: dateFrom || null,
      dateTo:   dateTo   || null,
    });

    return success(res, { provider, jobId: job.id, message: 'Sync job queued' });
  } catch (err) { next(err); }
};
