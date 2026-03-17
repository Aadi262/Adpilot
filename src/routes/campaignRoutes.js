'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validateZod = require('../middleware/validateZod');
const { createCampaignSchema, updateCampaignSchema } = require('../validators/schemas/campaignSchema');
const { campaignStartLimiter } = require('../middleware/rateLimiter');
const prisma = require('../config/prisma');
const {
  list,
  getOne,
  create,
  update,
  remove,
  launch,
  pause,
} = require('../controllers/campaignController');

const router = express.Router();

router.use(authenticate);

// Read — all authenticated roles
router.get('/', list);
router.get('/:id', getOne);

// Write — admin and manager only
router.post('/',           requireRole('admin', 'manager'), validateZod(createCampaignSchema), create);
router.patch('/:id',       requireRole('admin', 'manager'), validateZod(updateCampaignSchema), update);
router.delete('/:id',      requireRole('admin', 'manager'), remove);
router.post('/:id/launch', campaignStartLimiter, requireRole('admin', 'manager'), launch);
router.post('/:id/pause',  requireRole('admin', 'manager'), pause);

/**
 * GET /api/v1/campaigns/:id/snapshots?days=7
 * Returns daily metric snapshots for a single campaign.
 * Powers the campaign detail panel chart.
 */
router.get('/:id/snapshots', async (req, res, next) => {
  try {
    const { id } = req.params;
    const days  = Math.min(parseInt(req.query.days) || 7, 90);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setUTCHours(0, 0, 0, 0);

    // Verify campaign belongs to team
    const campaign = await prisma.campaign.findFirst({
      where: { id, teamId: req.user.teamId, deletedAt: null },
      select: { id: true, name: true, platform: true, budget: true, status: true, performance: true },
    });
    if (!campaign) return res.status(404).json({ success: false, error: { message: 'Campaign not found' } });

    const snapshots = await prisma.campaignMetricSnapshot.findMany({
      where:   { campaignId: id, date: { gte: since } },
      orderBy: { date: 'asc' },
      select:  { date: true, spend: true, revenue: true, roas: true, clicks: true, impressions: true, conversions: true, ctr: true, cpa: true, source: true },
    });

    // Compute summary from snapshots (last 7d averages)
    const hasSnapshots = snapshots.length > 0;
    const summary = hasSnapshots ? {
      totalSpend:      snapshots.reduce((s, r) => s + r.spend, 0),
      totalClicks:     snapshots.reduce((s, r) => s + r.clicks, 0),
      totalConversions:snapshots.reduce((s, r) => s + r.conversions, 0),
      avgRoas:         snapshots.filter(r => r.roas > 0).reduce((s, r, _, a) => s + r.roas / a.length, 0),
      avgCtr:          snapshots.filter(r => r.ctr > 0).reduce((s, r, _, a) => s + r.ctr / a.length, 0),
      avgCpa:          snapshots.filter(r => r.cpa > 0).reduce((s, r, _, a) => s + r.cpa / a.length, 0),
    } : null;

    return res.json({
      success: true,
      data: {
        campaign,
        snapshots: snapshots.map(s => ({
          ...s,
          date:  s.date.toISOString().split('T')[0],
          label: new Date(s.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        })),
        summary,
        hasData: hasSnapshots,
        days,
      },
    });
  } catch (err) { next(err); }
});

module.exports = router;
