'use strict';

const express          = require('express');
const { authenticate } = require('../middleware/auth');
const ctrl             = require('../controllers/notificationController');

const router = express.Router();
router.use(authenticate);

router.get('/',              ctrl.getNotifications);
router.patch('/read-all',    ctrl.markAllRead);
router.patch('/:id/read',    ctrl.markRead);
router.delete('/:id',        ctrl.deleteNotification);

// Dev-only test endpoint
if (process.env.NODE_ENV !== 'production') {
  router.post('/test', ctrl.createTest);
}

module.exports = router;
