'use strict';

const integrationService = require('../services/integrations/IntegrationService');
const { queues }         = require('../queues');
const { success, created } = require('../common/response');
const config             = require('../config');

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

// GET /api/v1/integrations/:provider/oauth-url — generate OAuth authorization URL
exports.getOAuthUrl = async (req, res, next) => {
  try {
    const { provider } = req.params;
    const redirectUri = `${config.frontendUrl}/integrations/callback`;

    let url;
    if (provider === 'meta') {
      if (!process.env.META_APP_ID) {
        return res.status(503).json({ success: false, error: { message: 'Meta app credentials not configured on this server.' } });
      }
      const params = new URLSearchParams({
        client_id:     process.env.META_APP_ID,
        redirect_uri:  redirectUri,
        scope:         'ads_read,ads_management,business_management',
        response_type: 'code',
        state:         provider,
      });
      url = `https://www.facebook.com/dialog/oauth?${params}`;
    } else if (provider === 'google') {
      if (!process.env.GOOGLE_CLIENT_ID) {
        return res.status(503).json({ success: false, error: { message: 'Google app credentials not configured on this server.' } });
      }
      const params = new URLSearchParams({
        client_id:     process.env.GOOGLE_CLIENT_ID,
        redirect_uri:  redirectUri,
        scope:         'https://www.googleapis.com/auth/adwords',
        response_type: 'code',
        access_type:   'offline',
        prompt:        'consent',
        state:         provider,
      });
      url = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    } else {
      return res.status(400).json({ success: false, error: { message: `OAuth not supported for ${provider}` } });
    }

    return success(res, { url, redirectUri });
  } catch (err) { next(err); }
};

// GET /api/v1/integrations/status — which API keys are configured
exports.getStatus = async (req, res, next) => {
  try {
    const e = process.env;
    return res.json({
      success: true,
      data: {
        ai: {
          anthropic:   !!e.ANTHROPIC_API_KEY,
          gemini:      !!e.GEMINI_API_KEY,
          openai:      !!e.OPENAI_API_KEY,
          groq:        !!e.GROQ_API_KEY,
          huggingface: !!e.HUGGINGFACE_API_KEY,
          ollama:      !!e.OLLAMA_URL,
        },
        adPlatforms: {
          meta:   !!e.META_ACCESS_TOKEN,
          google: !!e.GOOGLE_ADS_DEVELOPER_TOKEN,
          ga4:    !!e.GA4_MEASUREMENT_ID,
        },
        seo: {
          valueserp: !!e.VALUESERP_API_KEY,
        },
        missing: [
          !e.META_ACCESS_TOKEN             && 'META_ACCESS_TOKEN',
          !e.GOOGLE_ADS_DEVELOPER_TOKEN    && 'GOOGLE_ADS_DEVELOPER_TOKEN',
          !e.GA4_MEASUREMENT_ID            && 'GA4_MEASUREMENT_ID',
        ].filter(Boolean),
      },
      error: null,
      meta: { timestamp: new Date().toISOString() },
    });
  } catch (err) { next(err); }
};
