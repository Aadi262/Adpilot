'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const ctrl = require('../controllers/integrationController');

const router = express.Router();
router.use(authenticate);

router.get('/status',                     ctrl.getStatus);      // which AI/ad keys are present
router.get('/',                           ctrl.listProviders);
router.get('/:provider/oauth-url',        requireRole('admin'), ctrl.getOAuthUrl);
router.post('/:provider/connect',         requireRole('admin'), ctrl.connect);
router.delete('/:provider/disconnect',    requireRole('admin'), ctrl.disconnect);
router.post('/:provider/sync',            requireRole('admin', 'manager'), ctrl.syncData);

module.exports = router;
