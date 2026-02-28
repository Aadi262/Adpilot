'use strict';

const jwt    = require('jsonwebtoken');
const config = require('../config');
const AppError = require('../common/AppError');
const als    = require('../config/als');

/** Verify Bearer token, attach req.user = { userId, teamId, role } */
function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) throw AppError.unauthorized('No token provided');

    const token = header.slice(7);
    const payload = jwt.verify(token, config.jwt.secret);
    req.user = { userId: payload.userId, teamId: payload.teamId, role: payload.role };

    // Stamp teamId onto the current ALS store so all subsequent logger calls
    // within this request automatically include teamId without manual threading.
    const store = als.getStore();
    if (store) store.teamId = payload.teamId;

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')  return next(AppError.unauthorized('Invalid token'));
    if (err.name === 'TokenExpiredError')  return next(AppError.unauthorized('Token expired'));
    next(err);
  }
}

/** RBAC guard — must come after authenticate */
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user)                  return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) return next(AppError.forbidden(`Requires role: ${roles.join(' | ')}`));
    next();
  };
}

/**
 * Ownership guard — ensures the resource's teamId matches the token's teamId.
 * getTeamId: async (req) => string
 */
function requireTeamOwnership(getTeamId) {
  return async (req, res, next) => {
    try {
      const resourceTeamId = await getTeamId(req);
      if (!resourceTeamId || resourceTeamId !== req.user.teamId) {
        return next(AppError.forbidden('Access denied to this resource'));
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

module.exports = { authenticate, requireRole, requireTeamOwnership };
