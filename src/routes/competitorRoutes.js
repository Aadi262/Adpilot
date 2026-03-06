'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/researchController');

const router = express.Router();
router.use(authenticate);

router.get('/',                               ctrl.listCompetitors);
router.post('/',        requireRole('admin', 'manager'), ctrl.createCompetitor);
router.post('/analyze', requireRole('admin', 'manager'), ctrl.analyzeUrl);
router.delete('/:id',   requireRole('admin', 'manager'), ctrl.deleteCompetitor);

module.exports = router;
