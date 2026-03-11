'use strict';

const prisma = require('../config/prisma');

class CampaignIntelligenceRepository {
  async getTeamSnapshot(teamId) {
    const [team, campaigns, recentNotifications] = await Promise.all([
      prisma.team.findUnique({
        where: { id: teamId },
        select: { id: true, timezone: true, name: true },
      }),
      prisma.campaign.findMany({
        where: {
          teamId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          platform: true,
          status: true,
          objective: true,
          budget: true,
          budgetType: true,
          startDate: true,
          endDate: true,
          performance: true,
          createdAt: true,
          updatedAt: true,
          campaignAlerts: {
            where: { teamId },
            orderBy: { createdAt: 'desc' },
            select: {
              id: true,
              alertType: true,
              threshold: true,
              action: true,
              actionValue: true,
              isActive: true,
              triggeredAt: true,
              createdAt: true,
            },
          },
        },
      }),
      prisma.notification.findMany({
        where: {
          teamId,
          OR: [
            { type: 'budget_ai_action' },
            { type: 'rule_triggered' },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 25,
        select: {
          id: true,
          campaignId: true,
          type: true,
          message: true,
          createdAt: true,
        },
      }),
    ]);

    return {
      team: team || { id: teamId, timezone: 'UTC', name: 'Unknown Team' },
      campaigns,
      recentNotifications,
    };
  }
}

module.exports = {
  campaignIntelligenceRepository: new CampaignIntelligenceRepository(),
};
