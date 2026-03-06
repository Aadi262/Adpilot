'use strict';

const prisma       = require('../config/prisma');
const pulseService = require('../services/pulse/PulseService');
const { success }  = require('../common/response');
const { parsePagination } = require('../common/pagination');

// GET /api/v1/pulse/alerts
exports.getAlerts = async (req, res, next) => {
  try {
    const { limit } = parsePagination(req.query);

    const notifications = await prisma.notification.findMany({
      where:   { teamId: req.user.teamId, type: 'ALERT' },
      orderBy: { createdAt: 'desc' },
      take:    limit,
      select:  { id: true, message: true, status: true, createdAt: true },
    });

    // Strip internal [rule:xxx] tags from messages before sending to client
    const alerts = notifications.map(n => ({
      id:        n.id,
      message:   n.message.replace(/\s*\[rule:[^\]]+\]/g, '').trim(),
      read:      n.status !== 'pending',
      createdAt: n.createdAt,
    }));

    return success(res, {
      alerts,
      total:    alerts.length,
      demoMode: pulseService.demoMode(),
      connected: pulseService.connected(),
    });
  } catch (err) { next(err); }
};

// POST /api/v1/pulse/check
exports.runCheck = async (req, res, next) => {
  try {
    const result = await pulseService.scan(req.user.teamId);
    return success(res, result);
  } catch (err) { next(err); }
};

// GET /api/v1/pulse/status
exports.getStatus = async (req, res, next) => {
  try {
    return success(res, {
      demoMode:  pulseService.demoMode(),
      connected: pulseService.connected(),
      message:   pulseService.demoMode()
        ? 'Demo mode — connect Meta Ads or Google Ads for live data'
        : 'Live mode — real platform data active',
    });
  } catch (err) { next(err); }
};
