'use strict';

const { getRedis } = require('../../config/redis');
const { campaignIntelligenceRepository } = require('../../repositories/CampaignIntelligenceRepository');
const campaignSignalService = require('./CampaignSignalService');

const CACHE_TTL = 90;

class LiveCampaignAnalyzerService {
  async getTeamAnalyzer(teamId, { force = false } = {}) {
    const cacheKey = `budget-ai:analyzer:${teamId}`;
    const redis = getRedis();

    if (!force) {
      try {
        const cached = await redis.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (_) {
        // Continue on cache failure.
      }
    }

    const snapshot = await campaignIntelligenceRepository.getTeamSnapshot(teamId);
    const peerBaselines = campaignSignalService.buildPeerBaselines(snapshot.campaigns);

    const campaigns = snapshot.campaigns.map((campaign) => {
      const recentNotifications = snapshot.recentNotifications.filter((item) => item.campaignId === campaign.id);
      return campaignSignalService.buildCampaignDossier({
        campaign,
        peerBaselines,
        teamTimezone: snapshot.team.timezone,
        recentNotifications,
      });
    });

    const result = {
      generatedAt: new Date().toISOString(),
      team: snapshot.team,
      summary: campaignSignalService.summarize(campaigns),
      campaigns,
      dataGaps: this._buildGlobalDataGaps(campaigns),
      operatorFeed: this._buildOperatorFeed(campaigns),
    };

    try {
      await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(result));
    } catch (_) {
      // Ignore cache write failures.
    }

    return result;
  }

  _buildGlobalDataGaps(campaigns) {
    const gapCounts = new Map();

    campaigns.forEach((campaign) => {
      campaign.dataGaps.forEach((gap) => {
        gapCounts.set(gap, (gapCounts.get(gap) || 0) + 1);
      });
    });

    return Array.from(gapCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([message, count]) => ({
        message,
        campaignsAffected: count,
      }));
  }

  _buildOperatorFeed(campaigns) {
    return campaigns
      .flatMap((campaign) => campaign.recommendedActions.map((action) => ({
        campaignId: campaign.id,
        campaignName: campaign.name,
        platform: campaign.platform,
        type: action.type,
        label: action.label,
        reason: action.reason,
        priority: action.priority,
        priorityScore: action.priorityScore,
        automatable: action.automatable,
      })))
      .sort((a, b) => b.priorityScore - a.priorityScore)
      .slice(0, 8);
  }
}

module.exports = new LiveCampaignAnalyzerService();
