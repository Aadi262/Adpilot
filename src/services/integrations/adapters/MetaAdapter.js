'use strict';

const axios     = require('axios');
const BaseAdapter = require('./BaseAdapter');
const logger    = require('../../../config/logger');
const AppError  = require('../../../common/AppError');

const GRAPH_URL = 'https://graph.facebook.com/v18.0';

class MetaAdapter extends BaseAdapter {
  get provider() { return 'meta'; }

  async connect(code, redirectUri) {
    try {
      const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
        params: {
          client_id:     process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          redirect_uri:  redirectUri,
          code,
        },
      });
      const expiresAt = data.expires_in
        ? new Date(Date.now() + data.expires_in * 1000)
        : null;
      return { accessToken: data.access_token, refreshToken: null, expiresAt };
    } catch (err) {
      throw AppError.badRequest(`Meta OAuth failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async refresh(longLivedToken) {
    // Meta uses long-lived tokens (60 days) — exchange for new one
    try {
      const { data } = await axios.get(`${GRAPH_URL}/oauth/access_token`, {
        params: {
          grant_type:    'fb_exchange_token',
          client_id:     process.env.META_APP_ID,
          client_secret: process.env.META_APP_SECRET,
          fb_exchange_token: longLivedToken,
        },
      });
      const expiresAt = new Date(Date.now() + data.expires_in * 1000);
      return { accessToken: data.access_token, expiresAt };
    } catch (err) {
      throw AppError.badRequest(`Meta token refresh failed: ${err.message}`);
    }
  }

  async fetchData({ accessToken, adAccountId, dateFrom, dateTo }) {
    try {
      const { data } = await axios.get(`${GRAPH_URL}/act_${adAccountId}/insights`, {
        params: {
          access_token: accessToken,
          time_range: JSON.stringify({ since: dateFrom, until: dateTo }),
          fields: 'campaign_id,campaign_name,spend,clicks,impressions,actions,ctr,cpc,cpp',
          level: 'campaign',
          limit: 100,
        },
      });
      return this._normalizeInsights(data.data || []);
    } catch (err) {
      logger.error('Meta fetchData error', { error: err.response?.data || err.message });
      throw AppError.internal('Failed to fetch Meta Ads data');
    }
  }

  _normalizeInsights(raw) {
    return raw.map((row) => ({
      externalId:   row.campaign_id,
      name:         row.campaign_name,
      platform:     'meta',
      spend:        parseFloat(row.spend || 0),
      clicks:       parseInt(row.clicks || 0, 10),
      impressions:  parseInt(row.impressions || 0, 10),
      conversions:  parseInt(row.actions?.find((a) => a.action_type === 'purchase')?.value || 0, 10),
      ctr:          parseFloat(row.ctr || 0),
    }));
  }

  async createCampaign({ accessToken, adAccountId, campaignData }) {
    const { data } = await axios.post(`${GRAPH_URL}/act_${adAccountId}/campaigns`, {
      access_token: accessToken,
      name:         campaignData.name,
      objective:    campaignData.objective?.toUpperCase() || 'CONVERSIONS',
      status:       'PAUSED',
      special_ad_categories: [],
    });
    return { externalId: data.id };
  }

  async pauseCampaign({ accessToken, externalCampaignId }) {
    try {
      await axios.post(`${GRAPH_URL}/${externalCampaignId}`, {
        access_token: accessToken,
        status: 'PAUSED',
      });
      logger.info('Meta campaign paused', { externalCampaignId });
      return { success: true };
    } catch (err) {
      throw AppError.internal(`Meta pauseCampaign failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  /**
   * Update a campaign's daily budget on Meta (Campaign Budget Optimization assumed).
   * Meta budget fields are in the account currency's smallest unit (cents for USD).
   * @param {{ accessToken, externalCampaignId, dailyBudget }} params
   *   dailyBudget — new budget in dollars; converted to cents internally
   */
  async updateBudget({ accessToken, externalCampaignId, dailyBudget }) {
    // Meta API accepts daily_budget as string of smallest currency unit (cents for USD)
    const budgetCents = Math.round(dailyBudget * 100);
    try {
      await axios.post(`${GRAPH_URL}/${externalCampaignId}`, {
        access_token:  accessToken,
        daily_budget:  String(budgetCents),
      });
      logger.info('Meta campaign budget updated', { externalCampaignId, dailyBudget, budgetCents });
      return { success: true };
    } catch (err) {
      throw AppError.internal(`Meta updateBudget failed: ${err.response?.data?.error?.message || err.message}`);
    }
  }

  async validateCredentials(accessToken) {
    try {
      const { data } = await axios.get(`${GRAPH_URL}/me`, { params: { access_token: accessToken } });
      return !!data.id;
    } catch {
      return false;
    }
  }
}

module.exports = new MetaAdapter();
