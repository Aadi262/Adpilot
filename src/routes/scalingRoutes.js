'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl = require('../controllers/scalingController');

const router = express.Router();
router.use(authenticate);

router.get('/readiness',      ctrl.getCampaignReadiness);
router.get('/all-campaigns',  ctrl.getAllCampaignsReadiness);

module.exports = router;
