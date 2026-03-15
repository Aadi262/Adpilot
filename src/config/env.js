'use strict';

const Joi = require('joi');

const schema = Joi.object({
  // ── Core ──────────────────────────────────────────────────────────────────
  NODE_ENV:             Joi.string().valid('development', 'production', 'test').default('development'),
  PORT:                 Joi.number().default(3000),

  // ── Database + Redis ──────────────────────────────────────────────────────
  DATABASE_URL:         Joi.string().uri().required(),
  REDIS_URL:            Joi.string().uri().required(),

  // ── JWT ───────────────────────────────────────────────────────────────────
  JWT_SECRET:           Joi.string().min(32).required(),
  JWT_REFRESH_SECRET:   Joi.string().min(32).required(),
  JWT_EXPIRES_IN:       Joi.string().default('15m'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),

  // ── Encryption (OAuth token storage) ─────────────────────────────────────
  ENCRYPTION_KEY:       Joi.string().length(64).default('0'.repeat(64)), // 32-byte hex

  // ── CORS + Invite links ───────────────────────────────────────────────────
  ALLOWED_ORIGINS:      Joi.string().optional().allow('').default('http://localhost:5173'),
  INVITE_BASE_URL:      Joi.string().uri().default('http://localhost:5173'),

  // ── SEO Engine ───────────────────────────────────────────────────────────
  SEO_ENGINE_V2:        Joi.alternatives().try(Joi.boolean(), Joi.string().allow('')).default(false),
  LIGHTHOUSE_ENABLED:   Joi.alternatives().try(Joi.boolean(), Joi.string().allow('')).default(false),
  SEO_SUMMARY_ENABLED:  Joi.alternatives().try(Joi.boolean(), Joi.string().allow('')).default(false),
  SEO_AUDIT_TIMEOUT_MS: Joi.number().default(300000),

  // ── Monitoring + Email ────────────────────────────────────────────────────
  SENTRY_DSN:           Joi.string().uri().optional().allow(''),
  RESEND_API_KEY:       Joi.string().optional().allow(''),
  RESEND_FROM_EMAIL:    Joi.string().email().default('noreply@adpilot.io'),

  // ── AI Providers (all optional — graceful fallback chain) ─────────────────
  GROQ_API_KEY:         Joi.string().optional().allow(''),
  TOGETHER_API_KEY:     Joi.string().optional().allow(''),
  GEMINI_API_KEY:       Joi.string().optional().allow(''),
  CEREBRAS_API_KEY:     Joi.string().optional().allow(''),
  ANTHROPIC_API_KEY:    Joi.string().optional().allow(''),
  OPENAI_API_KEY:       Joi.string().optional().allow(''),
  HUGGINGFACE_API_KEY:  Joi.string().optional().allow(''),
  HUGGINGFACE_MODEL:    Joi.string().optional().allow('').default('mistralai/Mistral-7B-Instruct-v0.3'),
  OLLAMA_URL:           Joi.string().optional().allow('').default('http://localhost:11434'),
  OLLAMA_MODEL:         Joi.string().optional().allow('').default('llama3'),
  TAVILY_API_KEY:       Joi.string().optional().allow(''),

  // ── SEO / Keyword tracking ────────────────────────────────────────────────
  VALUESERP_API_KEY:    Joi.string().optional().allow(''),
  SERP_API_KEY:         Joi.string().optional().allow(''),
  TEAM_DOMAIN:          Joi.string().optional().allow(''),

  // ── Traffic signal adapters ────────────────────────────────────────────────
  CLOUDFLARE_API_TOKEN: Joi.string().optional().allow(''),
  CLOUDFLARE_ACCOUNT_ID: Joi.string().optional().allow(''),
  SIMILARWEB_API_KEY:   Joi.string().optional().allow(''),

  // ── OAuth integrations ────────────────────────────────────────────────────
  META_APP_ID:          Joi.string().optional().allow(''),
  META_APP_SECRET:      Joi.string().optional().allow(''),
  GOOGLE_CLIENT_ID:     Joi.string().optional().allow(''),
  GOOGLE_CLIENT_SECRET: Joi.string().optional().allow(''),
  SLACK_CLIENT_ID:      Joi.string().optional().allow(''),
  SLACK_CLIENT_SECRET:  Joi.string().optional().allow(''),
}).unknown(true);

const { error, value } = schema.validate(process.env, { abortEarly: false });

if (error) {
  const missing = error.details.map((d) => d.message).join('\n  ');
  throw new Error(`Environment validation failed:\n  ${missing}`);
}

module.exports = value;
