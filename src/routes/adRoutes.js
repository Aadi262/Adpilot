'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validateZod = require('../middleware/validateZod');
const { createAdSchema, updateAdSchema, generateAdSchema } = require('../validators/schemas/adSchema');
const { list, create, update, remove, generate } = require('../controllers/adController');

const router = express.Router();

router.use(authenticate);

// Read — all authenticated roles
router.get('/campaigns/:campaignId/ads', list);

// Write — admin and manager only
router.post('/campaigns/:campaignId/ads',          requireRole('admin', 'manager'), validateZod(createAdSchema), create);
router.post('/campaigns/:campaignId/ads/generate', requireRole('admin', 'manager'), validateZod(generateAdSchema), generate);
router.patch('/ads/:id',                           requireRole('admin', 'manager'), validateZod(updateAdSchema), update);
router.delete('/ads/:id',                          requireRole('admin', 'manager'), remove);

module.exports = router;
