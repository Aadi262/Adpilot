'use strict';

const prisma  = require('../config/prisma');
const AppError = require('../common/AppError');
const { success } = require('../common/response');

exports.getNotifications = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.min(50, parseInt(req.query.limit, 10) || 20);
    const skip  = (page - 1) * limit;

    const where = { userId };
    if (req.query.status) where.status = req.query.status;
    if (req.query.type)   where.type   = req.query.type;

    const [notifications, total] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, skip, take: limit }),
      prisma.notification.count({ where }),
    ]);
    const unreadCount = await prisma.notification.count({ where: { userId, status: 'pending' } });

    return success(res, { notifications, unreadCount, total, page, limit });
  } catch (err) { next(err); }
};

exports.markRead = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const notif = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!notif) throw AppError.notFound('Notification');
    await prisma.notification.update({ where: { id }, data: { status: 'read' } });
    return success(res, { message: 'Marked as read' });
  } catch (err) { next(err); }
};

exports.markAllRead = async (req, res, next) => {
  try {
    const { userId } = req.user;
    await prisma.notification.updateMany({
      where: { userId, status: 'pending' },
      data:  { status: 'read' },
    });
    return success(res, { message: 'All notifications marked as read' });
  } catch (err) { next(err); }
};

exports.deleteNotification = async (req, res, next) => {
  try {
    const { userId } = req.user;
    const { id } = req.params;
    const notif = await prisma.notification.findFirst({ where: { id, userId }, select: { id: true } });
    if (!notif) throw AppError.notFound('Notification');
    await prisma.notification.delete({ where: { id } });
    return res.status(204).end();
  } catch (err) { next(err); }
};

// Dev-only: seed a test notification for the current user
exports.createTest = async (req, res, next) => {
  try {
    const { userId, teamId } = req.user;
    const types = ['info', 'success', 'warning', 'error'];
    const type  = types[Math.floor(Math.random() * types.length)];
    const notif = await prisma.notification.create({
      data: {
        teamId, userId,
        message: `Test ${type} notification created at ${new Date().toLocaleTimeString()}`,
        type, channel: 'in_app', status: 'pending',
      },
    });
    return success(res, { notification: notif });
  } catch (err) { next(err); }
};
