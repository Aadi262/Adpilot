'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/pulseController');

const router = express.Router();
router.use(authenticate);

// GET  /api/v1/pulse/alerts  — last 50 pulse notifications for the team
// POST /api/v1/pulse/check   — trigger an on-demand scan
// GET  /api/v1/pulse/status  — connected integrations + demo mode flag

router.get('/alerts',  ctrl.getAlerts);
router.post('/check',  requireRole('admin', 'manager'), ctrl.runCheck);
router.get('/status',  ctrl.getStatus);

module.exports = router;
