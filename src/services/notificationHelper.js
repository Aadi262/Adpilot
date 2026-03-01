'use strict';

/**
 * Shared helper: create an in_app notification for a team.
 * Fire-and-forget — errors are logged, never thrown.
 */
const prisma = require('../config/prisma');
const logger = require('../config/logger');

/**
 * @param {string} teamId
 * @param {object} opts
 * @param {string} opts.userId   — recipient user id
 * @param {string} opts.message  — notification body
 * @param {string} [opts.type]   — 'info'|'success'|'warning'|'error'
 * @param {string} [opts.campaignId]
 */
async function createNotification(teamId, { userId, message, type = 'info', campaignId } = {}) {
  try {
    if (!teamId || !userId || !message) return;
    await prisma.notification.create({
      data: {
        teamId,
        userId,
        message,
        type:    type,
        channel: 'in_app',
        status:  'pending',
        ...(campaignId ? { campaignId } : {}),
      },
    });
  } catch (err) {
    logger.error('createNotification failed', { err: err.message, teamId });
  }
}

module.exports = { createNotification };
