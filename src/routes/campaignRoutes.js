'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validateZod = require('../middleware/validateZod');
const { createCampaignSchema, updateCampaignSchema } = require('../validators/schemas/campaignSchema');
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
router.post('/:id/launch', requireRole('admin', 'manager'), launch);
router.post('/:id/pause',  requireRole('admin', 'manager'), pause);

module.exports = router;
