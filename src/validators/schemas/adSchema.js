'use strict';
const { z } = require('zod');
const PLATFORMS = ['meta', 'google', 'both'];
const STATUSES  = ['draft', 'active', 'paused'];
const CTA_TYPES = [
  'LEARN_MORE', 'SHOP_NOW', 'SIGN_UP', 'DOWNLOAD', 'CONTACT_US',
  'GET_QUOTE', 'BOOK_NOW', 'WATCH_MORE',
];
const createAdSchema = z.object({
  headline:    z.string().min(1, 'Headline is required').max(255),
  primaryText: z.string().min(1, 'Primary text is required').max(2000),
  description: z.string().max(1000).optional(),
  ctaType:     z.enum(CTA_TYPES).optional().default('LEARN_MORE'),
  imageUrl:    z.string().url('imageUrl must be a valid URL').optional(),
  landingUrl:  z.string().url('landingUrl must be a valid URL').optional(),
  platform:    z.enum(PLATFORMS, { errorMap: () => ({ message: `platform must be one of: ${PLATFORMS.join(', ')}` }) }),
  status:      z.enum(STATUSES).optional().default('draft'),
}).strict();
const updateAdSchema = z.object({
  headline:    z.string().min(1).max(255).optional(),
  primaryText: z.string().min(1).max(2000).optional(),
  description: z.string().max(1000).optional().nullable(),
  ctaType:     z.enum(CTA_TYPES).optional(),
  imageUrl:    z.string().url().optional().nullable(),
  landingUrl:  z.string().url().optional().nullable(),
  platform:    z.enum(PLATFORMS).optional(),
  status:      z.enum(STATUSES).optional(),
}).strict();
const GOALS = ['awareness', 'traffic', 'conversions', 'leads', 'sales', 'engagement'];
const generateAdSchema = z.object({
  keyword:        z.string().min(2).max(200).optional(),
  platform:       z.string().max(50).optional(),
  goal:           z.string().max(50).optional(),
  tone:           z.string().max(100).optional(),
  targetAudience: z.string().max(500).optional(),
  productName:    z.string().max(255).optional(),
  uniqueValue:    z.string().max(500).optional(),
  count:          z.coerce.number().int().min(1).max(5).optional().default(3),
});
module.exports = { createAdSchema, updateAdSchema, generateAdSchema };
