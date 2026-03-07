'use strict';

require('dotenv').config();

const bcrypt = require('bcrypt');
const prisma = require('../config/prisma');

const SALT_ROUNDS = 12;

async function seed() {
  console.log('🌱 Starting seed...\n');

  // ── Clean existing seed data ──────────────────────────────────────────────
  await prisma.notification.deleteMany({});
  await prisma.rule.deleteMany({});
  await prisma.ad.deleteMany({});
  await prisma.campaign.deleteMany({});
  await prisma.keyword.deleteMany({});
  await prisma.competitor.deleteMany({});
  await prisma.seoAudit.deleteMany({});
  await prisma.contentBrief.deleteMany({});
  await prisma.researchReport.deleteMany({});
  await prisma.integration.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.team.deleteMany({});

  console.log('✓ Cleared existing data');

  // ── Team ──────────────────────────────────────────────────────────────────
  const team = await prisma.team.create({
    data: {
      name: 'AdPilot Demo',
      slug: 'adpilot-demo',
      plan: 'pro',
    },
  });
  console.log(`✓ Team: ${team.name} (${team.id})`);

  // ── Users ─────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('password123', SALT_ROUNDS);
  const managerPassword = await bcrypt.hash('password123', SALT_ROUNDS);

  const admin = await prisma.user.create({
    data: {
      teamId: team.id,
      name: 'Admin User',
      email: 'admin@adpilot.com',
      password: adminPassword,
      role: 'admin',
    },
  });

  const manager = await prisma.user.create({
    data: {
      teamId: team.id,
      name: 'Manager User',
      email: 'manager@adpilot.com',
      password: managerPassword,
      role: 'manager',
    },
  });

  console.log(`✓ Users: ${admin.email}, ${manager.email}`);

  // ── Campaigns ─────────────────────────────────────────────────────────────
  const campaignsData = [
    {
      name: 'Summer Sale – Meta',
      platform: 'meta',
      objective: 'conversions',
      status: 'active',
      budget: 150.00,
      budgetType: 'daily',
      // Intentionally poor ROAS + low CTR to demonstrate pulse alerts
      performance: { spend: 1240.50, roas: 0.8, clicks: 4200, impressions: 87000, ctr: 0.3, cpa: 65.2, conversions: 19 },
    },
    {
      name: 'Brand Awareness – Google',
      platform: 'google',
      objective: 'awareness',
      status: 'active',
      budget: 200.00,
      budgetType: 'daily',
      performance: { spend: 3100.00, roas: 2.1, clicks: 9800, impressions: 210000, ctr: 4.67 },
    },
    {
      name: 'Retargeting – Both Platforms',
      platform: 'both',
      objective: 'retargeting',
      status: 'paused',
      budget: 75.00,
      budgetType: 'daily',
      performance: { spend: 540.00, roas: 5.2, clicks: 1800, impressions: 22000, ctr: 8.18 },
    },
    {
      name: 'Product Launch – Meta',
      platform: 'meta',
      objective: 'conversions',
      status: 'draft',
      budget: 500.00,
      budgetType: 'lifetime',
      performance: {},
    },
    {
      name: 'Q2 Lead Gen – Google',
      platform: 'google',
      objective: 'lead_generation',
      status: 'draft',
      budget: 100.00,
      budgetType: 'daily',
      performance: {},
    },
  ];

  const campaigns = await Promise.all(
    campaignsData.map((c) =>
      prisma.campaign.create({
        data: { ...c, teamId: team.id },
      })
    )
  );

  console.log(`✓ Campaigns: ${campaigns.length} created`);

  // ── Ads ───────────────────────────────────────────────────────────────────
  const adsData = [
    // Summer Sale – Meta (campaigns[0])
    {
      campaignId: campaigns[0].id,
      headline: 'Summer Sale – Up to 50% Off',
      primaryText: "Shop our biggest sale of the year. Limited time only - grab your favourites before they're gone.",
      description: 'Free shipping on orders over $50.',
      ctaType: 'SHOP_NOW',
      platform: 'meta',
      status: 'active',
      performance: { impressions: 43000, clicks: 2100, spend: 620.25, roas: 4.1 },
    },
    {
      campaignId: campaigns[0].id,
      headline: 'Don\'t Miss Summer Deals',
      primaryText: 'Exclusive discounts on top products. Shop now and save big this summer.',
      ctaType: 'LEARN_MORE',
      platform: 'meta',
      status: 'active',
      performance: { impressions: 44000, clicks: 2100, spend: 620.25, roas: 3.5 },
    },
    // Brand Awareness – Google (campaigns[1])
    {
      campaignId: campaigns[1].id,
      headline: 'The #1 Platform for Growth',
      primaryText: 'Join over 10,000 businesses that trust AdPilot to power their ad campaigns.',
      description: 'Start your free trial today.',
      ctaType: 'GET_STARTED',
      platform: 'google',
      status: 'active',
      performance: { impressions: 105000, clicks: 4900, spend: 1550.00, roas: 2.0 },
    },
    {
      campaignId: campaigns[1].id,
      headline: 'Grow Your Business with AdPilot',
      primaryText: 'AI-powered ad automation that drives real results. No guesswork, just growth.',
      ctaType: 'LEARN_MORE',
      platform: 'google',
      status: 'active',
      performance: { impressions: 105000, clicks: 4900, spend: 1550.00, roas: 2.2 },
    },
    // Retargeting – Both (campaigns[2])
    {
      campaignId: campaigns[2].id,
      headline: 'Still Thinking About It?',
      primaryText: 'You left something behind. Come back and complete your purchase – it\'s still waiting for you.',
      ctaType: 'SHOP_NOW',
      platform: 'meta',
      status: 'paused',
      performance: { impressions: 11000, clicks: 900, spend: 270.00, roas: 5.4 },
    },
    {
      campaignId: campaigns[2].id,
      headline: 'Complete Your Order Today',
      primaryText: 'We saved your cart. Finish your purchase and get 10% off with code COMEBACK.',
      ctaType: 'BUY_NOW',
      platform: 'google',
      status: 'paused',
      performance: { impressions: 11000, clicks: 900, spend: 270.00, roas: 5.0 },
    },
    // Product Launch – Meta (campaigns[3])
    {
      campaignId: campaigns[3].id,
      headline: 'Introducing Our New Product',
      primaryText: 'Be the first to experience our revolutionary new product. Pre-order now.',
      ctaType: 'PRE_REGISTER',
      platform: 'meta',
      status: 'draft',
      performance: {},
    },
    {
      campaignId: campaigns[3].id,
      headline: 'Something Big is Coming',
      primaryText: 'Get ready for a launch that will change everything. Sign up for early access.',
      ctaType: 'SIGN_UP',
      platform: 'meta',
      status: 'draft',
      performance: {},
    },
    // Q2 Lead Gen – Google (campaigns[4])
    {
      campaignId: campaigns[4].id,
      headline: 'Get a Free Consultation',
      primaryText: 'Speak with an expert and discover how we can help your business grow.',
      ctaType: 'GET_QUOTE',
      platform: 'google',
      status: 'draft',
      performance: {},
    },
    {
      campaignId: campaigns[4].id,
      headline: 'Download Our Free Guide',
      primaryText: 'Learn the top strategies for scaling your ad campaigns in 2024.',
      ctaType: 'DOWNLOAD',
      platform: 'google',
      status: 'draft',
      performance: {},
    },
  ];

  const ads = await Promise.all(
    adsData.map((a) => prisma.ad.create({ data: a }))
  );

  console.log(`✓ Ads: ${ads.length} created`);

  // ── Keywords ──────────────────────────────────────────────────────────────
  const keywordsData = [
    {
      teamId: team.id,
      keyword: 'ad automation software',
      searchVolume: 8100,
      difficulty: 62,
      currentRank: 14,
      previousRank: 19,
      trackedUrl: 'https://adpilot.com',
    },
    {
      teamId: team.id,
      keyword: 'facebook ads management tool',
      searchVolume: 5400,
      difficulty: 58,
      currentRank: 8,
      previousRank: 12,
      trackedUrl: 'https://adpilot.com/features',
    },
    {
      teamId: team.id,
      keyword: 'google ads automation',
      searchVolume: 12000,
      difficulty: 71,
      currentRank: 22,
      previousRank: 28,
      trackedUrl: 'https://adpilot.com/google-ads',
    },
  ];

  await Promise.all(
    keywordsData.map((k) => prisma.keyword.create({ data: k }))
  );

  console.log(`✓ Keywords: ${keywordsData.length} created`);

  // ── Competitors ───────────────────────────────────────────────────────────
  const competitorsData = [
    {
      teamId: team.id,
      name: 'AdEspresso',
      domain: 'adespresso.com',
      activeAdsCount: 34,
      topKeywords: ['facebook ads tool', 'ad management', 'social media advertising'],
    },
    {
      teamId: team.id,
      name: 'Smartly.io',
      domain: 'smartly.io',
      activeAdsCount: 67,
      topKeywords: ['ad automation', 'social advertising platform', 'performance marketing'],
    },
  ];

  await Promise.all(
    competitorsData.map((c) => prisma.competitor.create({ data: c }))
  );

  console.log(`✓ Competitors: ${competitorsData.length} created`);

  // ── Summary ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed complete!\n');
  console.log('─────────────────────────────────────────');
  console.log('  Login Credentials');
  console.log('─────────────────────────────────────────');
  console.log(`  Admin    │ admin@adpilot.com   │ password123`);
  console.log(`  Manager  │ manager@adpilot.com │ password123`);
  console.log('─────────────────────────────────────────\n');
}

seed()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
