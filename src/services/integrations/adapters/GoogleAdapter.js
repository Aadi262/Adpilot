'use strict';

const axios       = require('axios');
const BaseAdapter = require('./BaseAdapter');
const logger      = require('../../../config/logger');
const AppError    = require('../../../common/AppError');

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const ADS_URL   = 'https://googleads.googleapis.com/v14';

class GoogleAdapter extends BaseAdapter {
  get provider() { return 'google'; }

  // ─── Auth ─────────────────────────────────────────────────────────────────

  async connect(code, redirectUri) {
    try {
      const { data } = await axios.post(TOKEN_URL, {
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri:  redirectUri,
        grant_type:    'authorization_code',
      });
      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
      return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt };
    } catch (err) {
      throw AppError.badRequest(`Google OAuth failed: ${err.response?.data?.error_description || err.message}`);
    }
  }

  async refresh(refreshToken) {
    try {
      const { data } = await axios.post(TOKEN_URL, {
        refresh_token: refreshToken,
        client_id:     process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        grant_type:    'refresh_token',
      });
      const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);
      return { accessToken: data.access_token, expiresAt };
    } catch (err) {
      throw AppError.badRequest(`Google token refresh failed: ${err.message}`);
    }
  }

  // ─── Data Fetch ───────────────────────────────────────────────────────────

  /**
   * Fetch campaign performance + budget resource names for a date range.
   * Includes campaign_budget so the sync processor can store budgetResourceName.
   */
  async fetchData({ accessToken, customerId, dateFrom, dateTo }) {
    try {
      const query = `
        SELECT
          campaign.id,
          campaign.name,
          campaign.status,
          campaign.campaign_budget,
          metrics.cost_micros,
          metrics.clicks,
          metrics.impressions,
          metrics.conversions,
          metrics.ctr
        FROM campaign
        WHERE segments.date BETWEEN '${dateFrom}' AND '${dateTo}'
          AND campaign.status != 'REMOVED'
      `;
      const { data } = await axios.post(
        `${ADS_URL}/customers/${customerId}/googleAds:search`,
        { query },
        {
          headers: {
            Authorization:     `Bearer ${accessToken}`,
            'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN || '',
          },
        }
      );
      return this._normalizeResults(data.results || [], customerId);
    } catch (err) {
      logger.error('Google fetchData error', { error: err.response?.data || err.message });
      throw AppError.internal('Failed to fetch Google Ads data');
    }
  }

  _normalizeResults(raw, customerId) {
    return raw.map((row) => {
      // Budget resource name: "customers/123/campaignBudgets/456" → extract budget ID
      const budgetResourceName = row.campaign?.campaignBudget || null;
      const budgetId = budgetResourceName
        ? budgetResourceName.split('/').pop()
        : null;

      return {
        externalId:          String(row.campaign?.id || ''),
        name:                row.campaign?.name || '',
        platform:            'google',
        customerId,
        budgetResourceName,
        budgetId,
        spend:               (row.metrics?.costMicros || 0) / 1_000_000,
        clicks:              row.metrics?.clicks      || 0,
        impressions:         row.metrics?.impressions || 0,
        conversions:         row.metrics?.conversions || 0,
        ctr:                 parseFloat(((row.metrics?.ctr || 0) * 100).toFixed(2)),
      };
    });
  }

  // ─── Campaign Mutations ───────────────────────────────────────────────────

  async createCampaign({ accessToken, customerId, campaignData }) {
    // Stub: real implementation requires a CampaignBudget resource first, then Campaign
    logger.info('Google createCampaign stub called', { customerId, name: campaignData.name });
    return { externalId: `google_${Date.now()}` };
  }

  /**
   * Pause a Google Ads campaign using the Campaigns:mutate API.
   * @param {{ accessToken, externalCampaignId, accountId }} params
   *   accountId — Google Ads customer ID (e.g. "1234567890")
   *   externalCampaignId — numeric campaign ID from Google Ads
   */
  async pauseCampaign({ accessToken, externalCampaignId, accountId }) {
    const customerId = accountId;
    const resourceName = `customers/${customerId}/campaigns/${externalCampaignId}`;

    try {
      const { data } = await axios.post(
        `${ADS_URL}/customers/${customerId}/campaigns:mutate`,
        {
          operations: [
            {
              update:     { resourceName, status: 'PAUSED' },
              updateMask: 'status',
            },
          ],
        },
        {
          headers: {
            Authorization:     `Bearer ${accessToken}`,
            'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN || '',
          },
        }
      );
      logger.info('Google campaign paused', { customerId, externalCampaignId });
      return { success: true, results: data.results };
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.message;
      throw AppError.internal(`Google pauseCampaign failed: ${detail}`);
    }
  }

  /**
   * Update a Google Ads campaign's daily budget using CampaignBudgets:mutate.
   * @param {{ accessToken, accountId, budgetResourceName, dailyBudget }} params
   *   budgetResourceName — full resource name: "customers/{cid}/campaignBudgets/{bid}"
   *   dailyBudget        — new budget in dollars; converted to micros internally
   */
  async updateBudget({ accessToken, accountId, budgetResourceName, dailyBudget }) {
    if (!budgetResourceName) {
      throw AppError.badRequest('Google updateBudget requires budgetResourceName (sync first to populate it)');
    }

    const customerId   = accountId;
    const amountMicros = String(Math.round(dailyBudget * 1_000_000));

    try {
      const { data } = await axios.post(
        `${ADS_URL}/customers/${customerId}/campaignBudgets:mutate`,
        {
          operations: [
            {
              update:     { resourceName: budgetResourceName, amountMicros },
              updateMask: 'amount_micros',
            },
          ],
        },
        {
          headers: {
            Authorization:     `Bearer ${accessToken}`,
            'developer-token': process.env.GOOGLE_DEVELOPER_TOKEN || '',
          },
        }
      );
      logger.info('Google campaign budget updated', { customerId, budgetResourceName, dailyBudget });
      return { success: true, results: data.results };
    } catch (err) {
      const detail = err.response?.data?.error?.message || err.message;
      throw AppError.internal(`Google updateBudget failed: ${detail}`);
    }
  }

  // ─── Credentials ──────────────────────────────────────────────────────────

  async validateCredentials(accessToken) {
    try {
      const { data } = await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { access_token: accessToken },
      });
      return !!data.aud;
    } catch {
      return false;
    }
  }
}

module.exports = new GoogleAdapter();
