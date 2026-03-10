'use strict';

const Joi = require('joi');

const schema = Joi.object({
  NODE_ENV:             Joi.string().valid('development', 'production', 'test').default('development'),
  PORT:                 Joi.number().default(3000),
  DATABASE_URL:         Joi.string().uri().required(),
  REDIS_URL:            Joi.string().uri().required(),
  JWT_SECRET:           Joi.string().min(32).required(),
  JWT_REFRESH_SECRET:   Joi.string().min(32).required(),
  JWT_EXPIRES_IN:       Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
  ENCRYPTION_KEY:       Joi.string().length(64).default('0'.repeat(64)), // 32-byte hex
  SENTRY_DSN:           Joi.string().uri().optional().allow(''),
  RESEND_API_KEY:       Joi.string().optional().allow(''),
  RESEND_FROM_EMAIL:    Joi.string().email().default('noreply@adpilot.io'),
  OPENAI_API_KEY:       Joi.string().optional().allow(''),
  GEMINI_API_KEY:       Joi.string().optional().allow(''),
  SERP_API_KEY:         Joi.string().optional().allow(''),
  VALUESERP_API_KEY:    Joi.string().optional().allow(''),
  META_APP_ID:          Joi.string().optional().allow(''),
  META_APP_SECRET:      Joi.string().optional().allow(''),
  GOOGLE_CLIENT_ID:     Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  SLACK_CLIENT_ID:      Joi.string().optional().allow(''),
  INVITE_BASE_URL:      Joi.string().uri().default('http://localhost:5173'),
}).unknown(true);

const { error, value } = schema.validate(process.env, { abortEarly: false });

if (error) {
  const missing = error.details.map((d) => d.message).join('\n  ');
  throw new Error(`Environment validation failed:\n  ${missing}`);
}

module.exports = value;
