'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validateZod = require('../middleware/validateZod');
const { createRuleSchema, updateRuleSchema } = require('../validators/schemas/ruleSchema');
const ctrl = require('../controllers/ruleController');

const router = express.Router();
router.use(authenticate);

router.get('/trigger-types',         ctrl.listTriggerTypes);
router.get('/',                      ctrl.listRules);
router.post('/',                     requireRole('admin', 'manager'), validateZod(createRuleSchema), ctrl.createRule);
router.patch('/:id',                 requireRole('admin', 'manager'), validateZod(updateRuleSchema), ctrl.updateRule);
router.delete('/:id',                requireRole('admin', 'manager'), ctrl.deleteRule);
router.post('/evaluate',             requireRole('admin', 'manager'), ctrl.triggerEvaluation);

module.exports = router;
