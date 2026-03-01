'use strict';

const express          = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl             = require('../controllers/userController');

const router = express.Router();
router.use(authenticate);

router.get('/',               ctrl.getMe);
router.patch('/',             ctrl.updateMe);
router.post('/change-password', ctrl.changePassword);

module.exports = router;
