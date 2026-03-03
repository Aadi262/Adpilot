'use strict';

require('dotenv').config();

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  jwt: {
    secret: process.env.JWT_SECRET || 'change_me_in_production',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'change_refresh_me_in_production',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  openaiApiKey:  process.env.OPENAI_API_KEY  || null,
  geminiApiKey:  process.env.GEMINI_API_KEY  || null,
  valueSerpKey:  process.env.VALUESERP_API_KEY || null,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  email: {
    resendApiKey: process.env.RESEND_API_KEY || null,
    from: process.env.EMAIL_FROM || 'noreply@adpilot.io',
  },
};

module.exports = config;
