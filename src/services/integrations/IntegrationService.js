'use strict';

const prisma      = require('../../config/prisma');
const encryption  = require('./TokenEncryptionService');
const AppError    = require('../../common/AppError');
const logger      = require('../../config/logger');

// Adapter registry — OCP: new adapters plug in here
const ADAPTERS = new Map();
[
  require('./adapters/MetaAdapter'),
  require('./adapters/GoogleAdapter'),
  require('./adapters/SlackAdapter'),
].forEach((a) => ADAPTERS.set(a.provider, a));

const ENCRYPTED_FIELDS    = ['accessToken', 'refreshToken'];
// Refresh token if it expires within this threshold (minutes)
const REFRESH_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

class IntegrationService {
  getAdapter(provider) {
    const adapter = ADAPTERS.get(provider);
    if (!adapter) throw AppError.badRequest(`Unsupported provider: ${provider}`);
    return adapter;
  }

  // ─── Connect / Disconnect ─────────────────────────────────────────────────

  /**
   * Exchange OAuth code for tokens and persist the integration.
   * @param {string}  teamId
   * @param {string}  provider
   * @param {string}  code        — OAuth authorization code
   * @param {string}  redirectUri
   * @param {string}  [accountId] — Meta ad account ID or Google customer ID
   */
  async connect(teamId, provider, code, redirectUri, accountId) {
    const adapter = this.getAdapter(provider);
    const tokens  = await adapter.connect(code, redirectUri);

    const encrypted = encryption.encryptFields(tokens, ENCRYPTED_FIELDS);

    const integration = await prisma.integration.upsert({
      where:  { teamId_provider: { teamId, provider } },
      create: { teamId, provider, accountId: accountId || null, ...encrypted, status: 'active' },
      update: { accountId: accountId || null, ...encrypted, status: 'active', lastSyncAt: new Date() },
    });

    logger.info('Integration connected', { teamId, provider, hasAccountId: !!accountId });
    return this._safeReturn(integration);
  }

  async disconnect(teamId, provider) {
    const integration = await prisma.integration.findUnique({
      where: { teamId_provider: { teamId, provider } },
    });
    if (!integration) throw AppError.notFound(`${provider} integration`);

    await prisma.integration.update({
      where: { id: integration.id },
      data:  { status: 'disconnected', accessToken: null, refreshToken: null },
    });
    logger.info('Integration disconnected', { teamId, provider });
  }

  // ─── Token access ─────────────────────────────────────────────────────────

  /**
   * Returns the full decrypted integration record (including accountId).
   * Auto-refreshes the access token if it is within REFRESH_THRESHOLD_MS of expiry.
   * Throws if integration is not found or not active.
   */
  async getActiveIntegration(teamId, provider) {
    const integration = await prisma.integration.findUnique({
      where: { teamId_provider: { teamId, provider } },
    });
    if (!integration)                   throw AppError.notFound(`${provider} integration`);
    if (integration.status !== 'active') throw AppError.badRequest(`${provider} integration is ${integration.status}`);

    const decrypted = encryption.decryptFields(integration, ENCRYPTED_FIELDS);

    // Auto-refresh if expiring within threshold
    const isExpiring = decrypted.tokenExpiresAt
      && new Date(decrypted.tokenExpiresAt).getTime() - Date.now() < REFRESH_THRESHOLD_MS;

    if (isExpiring && decrypted.refreshToken) {
      const adapter   = this.getAdapter(provider);
      const refreshed = await adapter.refresh(decrypted.refreshToken);
      const encrypted = encryption.encryptFields(refreshed, ['accessToken']);
      await prisma.integration.update({
        where: { id: integration.id },
        data:  { accessToken: encrypted.accessToken, tokenExpiresAt: refreshed.expiresAt },
      });
      decrypted.accessToken    = refreshed.accessToken;
      decrypted.tokenExpiresAt = refreshed.expiresAt;
      logger.info('Token auto-refreshed', { teamId, provider });
    }

    return decrypted;
  }

  /**
   * Legacy shim — kept for callers that only need the access token.
   * Prefer getActiveIntegration() for new code.
   */
  async getTokens(teamId, provider) {
    return this.getActiveIntegration(teamId, provider);
  }

  // ─── Platform campaign actions ────────────────────────────────────────────

  /**
   * Execute a campaign action on the platform adapter.
   * This is the single entry point RuleEngine uses — never dispatch adapters directly from rules.
   *
   * @param {string} teamId
   * @param {string} provider   — 'meta' | 'google'
   * @param {string} action     — 'pause_campaign' | 'update_budget'
   * @param {object} params     — { externalCampaignId, dailyBudget?, budgetResourceName? }
   * @returns {object|null}     — adapter result, or null if integration not connected
   */
  async callCampaignAction(teamId, provider, action, params) {
    let integration;
    try {
      integration = await this.getActiveIntegration(teamId, provider);
    } catch (err) {
      // Integration not connected — not an error, just no-op
      logger.info('No active integration — skipping platform action', { teamId, provider, action });
      return null;
    }

    const adapter   = this.getAdapter(provider);
    const baseParams = { accessToken: integration.accessToken, accountId: integration.accountId };

    switch (action) {
      case 'pause_campaign':
        return adapter.pauseCampaign({ ...baseParams, ...params });

      case 'update_budget':
        return adapter.updateBudget({ ...baseParams, ...params });

      default:
        logger.warn('Unknown platform action requested', { provider, action });
        return null;
    }
  }

  // ─── Data sync ────────────────────────────────────────────────────────────

  /**
   * Fetch platform performance data for a date range.
   * Returns normalized records — does NOT write to DB (that's integrationSyncProcessor's job).
   */
  async syncData(teamId, provider, params) {
    const integration = await this.getActiveIntegration(teamId, provider);
    const adapter     = this.getAdapter(provider);

    const data = await adapter.fetchData({
      ...params,
      accessToken: integration.accessToken,
      // Pass accountId for adapters that need it (Meta: adAccountId, Google: customerId)
      adAccountId: integration.accountId,
      customerId:  integration.accountId,
    });

    await prisma.integration.update({
      where: { id: integration.id },
      data:  { lastSyncAt: new Date() },
    });

    return data;
  }

  // ─── Token health check ───────────────────────────────────────────────────

  /**
   * Check all active integrations across all teams and refresh expiring tokens.
   * Called by tokenHealthCheckProcessor daily.
   *
   * @param {number} [thresholdMs] — refresh tokens expiring within this window (default 24h)
   * @returns {{ checked: number, refreshed: number, failed: number }}
   */
  async checkAndRefreshAllTokens(thresholdMs = 24 * 60 * 60 * 1000) {
    const integrations = await prisma.integration.findMany({
      where: {
        status: 'active',
        tokenExpiresAt: { not: null },
      },
    });

    let refreshed = 0;
    let failed    = 0;

    for (const integration of integrations) {
      const expiresAt = integration.tokenExpiresAt
        ? new Date(integration.tokenExpiresAt).getTime()
        : null;

      if (!expiresAt || expiresAt - Date.now() > thresholdMs) continue;

      const decrypted = encryption.decryptFields(integration, ENCRYPTED_FIELDS);
      if (!decrypted.refreshToken) continue;

      try {
        const adapter   = this.getAdapter(integration.provider);
        const refreshed_tokens = await adapter.refresh(decrypted.refreshToken);
        const encrypted = encryption.encryptFields(refreshed_tokens, ['accessToken']);

        await prisma.integration.update({
          where: { id: integration.id },
          data:  { accessToken: encrypted.accessToken, tokenExpiresAt: refreshed_tokens.expiresAt },
        });

        refreshed++;
        logger.info('Token health-check: refreshed', {
          teamId:   integration.teamId,
          provider: integration.provider,
          expiresAt: refreshed_tokens.expiresAt,
        });
      } catch (err) {
        failed++;
        logger.error('Token health-check: refresh failed', {
          integrationId: integration.id,
          teamId:        integration.teamId,
          provider:      integration.provider,
          error:         err.message,
        });
      }
    }

    return { checked: integrations.length, refreshed, failed };
  }

  // ─── Queries ──────────────────────────────────────────────────────────────

  async listIntegrations(teamId) {
    const integrations = await prisma.integration.findMany({ where: { teamId } });
    return integrations.map((i) => this._safeReturn(i));
  }

  /** Strip encrypted token fields before returning to callers */
  _safeReturn(integration) {
    // eslint-disable-next-line no-unused-vars
    const { accessToken, refreshToken, ...safe } = integration;
    return safe;
  }

  static listProviders() {
    return [...ADAPTERS.keys()];
  }
}

module.exports = new IntegrationService();
