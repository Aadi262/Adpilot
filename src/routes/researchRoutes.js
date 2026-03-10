'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/researchController');

const router = express.Router();
router.use(authenticate);

// Hijack analysis
router.get('/hijack-analysis', ctrl.hijackAnalysis);
router.get('/reports', ctrl.getReports);
router.get('/reports/latest', ctrl.getLatestReport);

module.exports = router;
