'use strict';

const bcrypt  = require('bcrypt');
const prisma  = require('../config/prisma');
const AppError = require('../common/AppError');
const { success } = require('../common/response');

const SALT_ROUNDS = 12;

exports.getMe = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where:  { id: req.user.userId },
      select: { id: true, name: true, email: true, role: true, teamId: true, createdAt: true },
    });
    if (!user) throw AppError.notFound('User');
    return success(res, { user });
  } catch (err) { next(err); }
};

exports.updateMe = async (req, res, next) => {
  try {
    const { name } = req.body;
    if (!name?.trim()) throw AppError.badRequest('name is required');
    const user = await prisma.user.update({
      where:  { id: req.user.userId },
      data:   { name: name.trim() },
      select: { id: true, name: true, email: true, role: true, teamId: true },
    });
    return success(res, { user });
  } catch (err) { next(err); }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) throw AppError.badRequest('currentPassword and newPassword are required');
    if (newPassword.length < 8) throw AppError.badRequest('New password must be at least 8 characters');

    const user = await prisma.user.findUnique({ where: { id: req.user.userId } });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) throw new AppError('Current password is incorrect', 401);

    const hashed = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await prisma.user.update({ where: { id: req.user.userId }, data: { password: hashed } });

    return success(res, { message: 'Password updated successfully' });
  } catch (err) { next(err); }
};
