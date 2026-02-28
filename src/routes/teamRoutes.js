'use strict';

const express = require('express');
const { authenticate, requireRole } = require('../middleware/auth');
const validateZod = require('../middleware/validateZod');
const {
  inviteMemberSchema,
  acceptInviteSchema,
  updateMemberRoleSchema,
} = require('../validators/schemas/teamSchema');
const ctrl = require('../controllers/teamController');

const router = express.Router();

// Public — accept invite (no auth required)
router.post('/invites/accept', validateZod(acceptInviteSchema), ctrl.acceptInvite);

// All below require auth
router.use(authenticate);

router.get('/',                       ctrl.getTeam);
router.patch('/',                     requireRole('admin'), ctrl.updateTeam);
router.get('/members',                ctrl.getMembers);
router.patch('/members/:userId/role', requireRole('admin'), validateZod(updateMemberRoleSchema), ctrl.updateMemberRole);
router.delete('/members/:userId',     requireRole('admin'), ctrl.removeMember);
router.post('/invites',               requireRole('admin', 'manager'), validateZod(inviteMemberSchema), ctrl.invite);
router.get('/invites',                requireRole('admin', 'manager'), ctrl.listInvites);
router.delete('/invites/:inviteId',   requireRole('admin'), ctrl.revokeInvite);
router.get('/permissions',            ctrl.getPermissions);

module.exports = router;
