'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/budgetProtectionController');

const router = express.Router();
router.use(authenticate);

// Alert rules CRUD
router.get('/alerts',           ctrl.listAlerts);
router.post('/alerts',          requireRole('admin', 'manager'), ctrl.createAlert);
router.patch('/alerts/:id',     requireRole('admin', 'manager'), ctrl.updateAlert);
router.delete('/alerts/:id',    requireRole('admin', 'manager'), ctrl.deleteAlert);

// Real scan using BudgetGuardian
router.get('/scan', ctrl.scan);

// Per-campaign health analysis
router.get('/campaign/:id', ctrl.analyzeCampaign);

// Apply a fix to a campaign (pause or reduce budget)
router.post('/apply-fix', requireRole('admin', 'manager'), ctrl.applyFix);

module.exports = router;
