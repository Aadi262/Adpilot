'use strict';

const bcrypt  = require('bcrypt');
const crypto  = require('crypto');
const jwt     = require('jsonwebtoken');
const config  = require('../config');
const prisma  = require('../config/prisma');
const userRepo = require('../repositories/userRepository');
const teamRepo = require('../repositories/teamRepository');
const { AppError }    = require('../middleware/errorHandler');
const emailService    = require('./email/EmailService');

const SALT_ROUNDS = 12;

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function generateUniqueSlug(base) {
  let slug = slugify(base);
  let existing = await teamRepo.findBySlug(slug);
  let counter = 1;
  while (existing) {
    slug = `${slugify(base)}-${counter}`;
    existing = await teamRepo.findBySlug(slug);
    counter += 1;
  }
  return slug;
}

function generateTokens(user) {
  const payload = {
    userId: user.id,
    teamId: user.teamId,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });

  const refreshToken = jwt.sign(payload, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
}

async function register({ name, email, password, teamName }) {
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    throw new AppError('Email already in use', 409);
  }

  const slug = await generateUniqueSlug(teamName);
  const team = await teamRepo.create({ name: teamName, slug });

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await userRepo.create({
    name,
    email,
    password: hashedPassword,
    teamId: team.id,
    role: 'admin',
  });

  const tokens = generateTokens(user);

  return {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: team.id,
      onboardingCompleted: false,
    },
    team: {
      id: team.id,
      name: team.name,
      slug: team.slug,
      plan: team.plan,
    },
    ...tokens,
  };
}

async function login({ email, password }) {
  const user = await userRepo.findByEmail(email);
  if (!user || !user.isActive) {
    throw new AppError('Invalid email or password', 401);
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    throw new AppError('Invalid email or password', 401);
  }

  const tokens = generateTokens(user);

  // Fetch team so the frontend store always has name + plan
  const team = await prisma.team.findUnique({
    where:  { id: user.teamId },
    select: { id: true, name: true, slug: true, plan: true },
  });

  return {
    user: {
      id:                  user.id,
      name:                user.name,
      email:               user.email,
      role:                user.role,
      teamId:              user.teamId,
      onboardingCompleted: user.onboardingCompleted,
    },
    team: team ?? null,
    ...tokens,
  };
}

/**
 * Generate a password reset token, store it (hashed) on the user,
 * and email a reset link. Always responds the same way regardless of
 * whether the email exists, to prevent user enumeration.
 */
async function forgotPassword(email) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return; // Silent: don't reveal existence

  const rawToken  = crypto.randomBytes(32).toString('hex');
  const hashed    = crypto.createHash('sha256').update(rawToken).digest('hex');
  const expiry    = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordResetToken: hashed, passwordResetExpiry: expiry },
  });

  const resetUrl = `${config.frontendUrl}/reset-password?token=${rawToken}`;
  await emailService.sendPasswordReset({ to: user.email, name: user.name, resetUrl });
}

/**
 * Verify the raw token, ensure it hasn't expired, then update the password.
 */
async function resetPassword(rawToken, newPassword) {
  const hashed = crypto.createHash('sha256').update(rawToken).digest('hex');

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken:  hashed,
      passwordResetExpiry: { gt: new Date() },
      isActive:            true,
    },
  });

  if (!user) throw new AppError('Reset link is invalid or has expired', 400);

  const hashedPwd = await bcrypt.hash(newPassword, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data:  {
      password:            hashedPwd,
      passwordResetToken:  null,
      passwordResetExpiry: null,
    },
  });
}

module.exports = { register, login, generateTokens, forgotPassword, resetPassword };
