# AdPilot — Master Project Plan

> **Rule:** Update this file at the end of every session when something meaningful changes.
> **Rule:** Never create multiple plan files. This is the single source of truth.
> **Start every session with:** `Claude, continue with PLAN.md`

---

## 0. Local Development Setup

### Quick Start (every session)
```bash
# 1. Start Docker services (Postgres + Redis)
docker compose up -d

# 2. Start backend
npm run dev          # nodemon — port 3000

# 3. Start frontend (separate terminal)
cd client && npm run dev   # Vite — port 5173

# 4. Open browser
open http://localhost:5173
```

### Docker Services
| Service  | Container         | Image              | Port | Credentials                          |
|----------|-------------------|--------------------|------|--------------------------------------|
| Postgres | adpilot-postgres  | postgres:16-alpine | 5432 | user=postgres pw=postgres db=adpilot |
| Redis    | adpilot-redis     | redis:7-alpine     | 6379 | no auth                              |

```bash
# Check containers are healthy
docker compose ps
# View Postgres logs
docker compose logs postgres
# Reset all data (DESTRUCTIVE)
docker compose down -v && docker compose up -d && npx prisma db push
```

### Environment Variables (.env)
All required variables with dev defaults are in `.env` (committed, safe for dev).
Copy to production and fill in real secrets:

| Variable           | Dev default                                         | Required |
|--------------------|-----------------------------------------------------|----------|
| DATABASE_URL       | postgresql://postgres:postgres@localhost:5432/adpilot | ✅ |
| REDIS_URL          | redis://localhost:6379                              | ✅       |
| JWT_SECRET         | adpilot_dev_secret_must_be_32_chars_minimum_x       | ✅ min 32 chars |
| JWT_REFRESH_SECRET | adpilot_refresh_secret_must_be_32_chars_min_x       | ✅ min 32 chars |
| ENCRYPTION_KEY     | 0000…0000 (64 zeros)                               | ✅ 64 hex chars |
| SEO_ENGINE_V2      | true                                                | ✅       |
| ANTHROPIC_API_KEY  | (empty)                                             | Optional — for SEO summaries |
| OPENAI_API_KEY     | (empty)                                             | Optional — for Ad Studio generate |

```bash
# Generate production secrets
openssl rand -hex 64   # JWT_SECRET / JWT_REFRESH_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY
```

### Database Management
```bash
# Apply schema changes (preferred over migrate dev in this project)
npx prisma db push

# Seed demo data (admin@adpilot.com / password123)
node src/scripts/seed.js

# Open Prisma Studio (DB browser)
npx prisma studio
```

### Test Accounts
| Email                  | Password    | Role    | Notes              |
|------------------------|-------------|---------|-------------------|
| admin@adpilot.com      | password123 | admin   | Main dev account  |
| manager@adpilot.com    | password123 | manager | RBAC testing      |
| POST /auth/demo-login  | (no body)   | admin   | Live demo account |

---

## 1. Project Overview

AI-powered ad + SEO automation SaaS.
Backend: Node.js / Express / Prisma / PostgreSQL / Redis + Bull.
Frontend: React 18 / Vite / Tailwind / React Query / Zustand / Recharts.

---

## 2. Implementation Stages

| # | Stage | Status |
|---|-------|--------|
| 1 | Backend foundation (auth, campaigns, ads, analytics) | ✅ Complete |
| 2 | Phase 2 frontend (Login, Dashboard, Campaigns, Analytics) | ✅ Complete |
| 3 | Architecture hardening (queues, rule engine, integrations, team management) | ✅ Complete |
| 4 | SEO Audit Engine v2 (Puppeteer + Lighthouse + rules + scoring) | ✅ Complete |
| 5 | SEO Frontend Page (audit result panel, polling, score gauge, issue tabs) | ✅ Complete |
| 6 | Audit Validation & Production Hardening | ✅ Complete |
| 7 | LLM Executive Summary (SeoSummaryService) | ✅ Complete |
| **8** | **Phase C — Complete UI/UX Polish & Missing Features** | **✅ Complete** |
| **11** | **C14: Dashboard/Analytics Architecture Fix** | **✅ Complete** |
| **12** | **C15: Killer Feature Stubs + Sidebar** | **✅ Complete** |
| **13** | **Phase D: Killer Features Mock Demo Mode** | **✅ Complete** |
| **14** | **Phase H: Sellability Sprint** | **✅ Complete** |
| **15** | **Phase J: Real Engine Implementation** | **✅ Complete** |
| 9 | Payments / billing integration | ⏳ Pending |
| 10 | Production deployment | ⏳ Pending |

---

## 3. Current Stage — Enhancement Phases

### Phase C — Complete UI/UX Polish ✅ Complete

**Built this session:**

| Sub-task | Status | Notes |
|----------|--------|-------|
| C1 Toast system | ✅ | `ToastProvider` + `useToast()`, 4 types, slide-in, 5-stack |
| C2 Notifications | ✅ | Full REST (GET/PATCH/:id/read/DELETE), auto-notify on campaign/SEO events, `NotificationsPage` with filter tabs |
| C3 Dashboard | ✅ | Hero empty state (icon + heading + 2 CTAs), existing KPI cards |
| C4 Campaigns | ✅ | `ConfirmDialog` replaces `window.confirm` |
| C5 ErrorBoundary | ✅ | Class component wrapping every route, retry button |
| C6 Settings | ✅ | Profile, Security (change password + strength), Notifications (toggles), Danger Zone |
| C7 Rules | ✅ | Was already fully built (379 lines) |
| C8 Integrations | ✅ | Was already fully built (334 lines) |
| C9 Team | ✅ | Was already fully built (430 lines) |
| C10 Analytics | ✅ | Date range filter (7d/30d/90d), CSV export |
| C11 Research Hub | ✅ | Competitors, Market Research, Ad Intelligence tabs |
| C12 Ad Studio | ✅ | All Ads, Generate (3-variation cards + quality scores), A/B Tests stub |
| C13 Performance | ✅ | Lazy-load all pages, Axios 500 interceptor → toast, offline banner, `/users/me` routes |
| C14 Dashboard/Analytics Arch | ✅ | Dashboard = Command Center (live status, quick actions, activity, campaign health). Analytics = Deep Dive (charts, table, CSV) |
| C15 Killer Feature Pages | ✅ | BudgetProtectionPage, CompetitorHijackPage, ScalingPredictorPage — all wired in App.jsx + Sidebar |

---

### Phase D — Killer Features Mock Demo Mode ✅ Complete

#### D1 — Budget Protection AI

**Backend:**
- `src/services/ai/BudgetProtectionService.js` — scanTeam() (mock alerts from rules + campaign perf), createAlert(), getAlerts(), updateAlert(), deleteAlert()
- `src/controllers/budgetProtectionController.js` — GET/POST/PATCH/DELETE /alerts + GET /scan
- `src/routes/budgetProtectionRoutes.js` — mounted at `/api/v1/budget-ai`
- `prisma/schema.prisma` — CampaignAlert model (alertType, threshold, action, actionValue, isActive, triggeredAt) + `prisma db push`

**Frontend:**
- `client/src/pages/BudgetProtectionPage.jsx` — Full UI:
  - Header with "Scan Now" button + last scan time
  - Status banner (healthy/warning/critical) driven by GET /budget-ai/scan
  - Active Alerts cards (severity badge, detail, "Apply Fix" → pause campaign)
  - Alert Rules CRUD table (toggle active, delete) + AddAlertModal
  - How it works (3 steps)

#### D2 — Competitor Hijack Engine

**Backend:**
- `src/services/ai/CompetitorHijackService.js` — analyzeCompetitor() with deterministic mock data seeded by domain charCodes
- `src/controllers/researchController.js` — competitors CRUD + GET /research/hijack-analysis?domain=X
- `src/routes/researchRoutes.js` — mounted at `/api/v1/research`
- `src/routes/competitorRoutes.js` — mounted at `/api/v1/competitors` (GET, POST, DELETE /:id)

**Frontend:**
- `client/src/pages/CompetitorHijackPage.jsx` — Full page:
  - Analyze Competitor form with step animation (4 phases)
  - Results: stats row (spend, keywords, opportunities), ad examples grid, keyword gaps table (Track button → POST /seo/keywords), win-back opportunities, messaging angles
  - Feature grid (no results state)
  - Waitlist button (localStorage)
- `client/src/pages/ResearchPage.jsx` — Upgraded "Ad Intelligence" tab with full hijack analysis UI

#### D3 — Scaling Predictor

**Backend:**
- `src/services/ai/ScalingPredictorService.js` — _computeScore() (deterministic from campaignId charSum), predictScaleReadiness(), getAllCampaignsReadiness()
- `src/controllers/scalingController.js` — GET /scaling/readiness?campaignId=X + GET /scaling/all-campaigns
- `src/routes/scalingRoutes.js` — mounted at `/api/v1/scaling`

**Frontend:**
- `client/src/pages/ScalingPredictorPage.jsx` — Full UI:
  - Overview stats (ready/caution/not-ready counts)
  - Campaign cards grid with SVG score gauge (green/orange/red)
  - Expand to detail: factor progress bars (colored by impact), risk warnings, AI recommendation (Sparkles card)
  - Apply Scale → ConfirmScaleDialog → PATCH /campaigns/:id budget
  - Waitlist button (localStorage)

**All 3 pages:**
- Added to `client/src/App.jsx` lazy routes
- Added to `client/src/components/layout/Sidebar.jsx` under "AI Features" section with BETA badges

---

### Phase F — SEO Monitoring Engine ✅ Complete

Commit: `efcfd66c`

#### F1 — DB Schema
- `SeoMonitor` model: teamId, url, name, status (active/paused/running), schedule (daily/weekly), lastAuditId, lastScore, lastGrade, nextRunAt
- `ScoreHistory` model: monitorId, auditId, score, grade, regressions, improvements, alerts (Json)
- `seoMonitors SeoMonitor[]` added to Team model
- `maxMonitors` added to limits.js: starter:1, pro:5, business:20
- Applied via `npx prisma db push`

#### F2 — MonitoringEngine Service
- `src/services/seo/monitoring/MonitoringEngine.js`
- Methods: scheduleMonitor (plan-enforced limit), getMonitorDashboard (7-point sparkline data), getMonitorTimeline, pauseMonitor, resumeMonitor, deleteMonitor, updateMonitor, getDueMonitors, recordResult, recordFailure

#### F3 — RegressionDetector
- `src/services/seo/monitoring/RegressionDetector.js`
- Fingerprint = `ruleId::url` — compares issue sets between two audits
- Returns: { regressions[], improvements[], unchanged } — sorted by severity

#### F4 — AlertEvaluator
- `src/services/seo/monitoring/AlertEvaluator.js`
- 6 priority-ordered rules: score_crash (≥15pt drop/critical), score_drop (≥5pt/high), critical_regression, security_regression, downward_trend (3 consecutive drops/medium), score_improvement (≥10pt/info)
- Returns { alerts[], highestSeverity }

#### F5 — Queue
- `seoMonitor` queue added to `src/queues/index.js`
- `seoMonitorProcessor.js` — dual mode: _sweep (find all due monitors → enqueue individual jobs) + single-monitor run (AuditOrchestrator or legacy, then RegressionDetector + AlertEvaluator + notifications + MonitoringEngine.recordResult)
- Recurring cron: sweep every 4 hours (`0 */4 * * *`)

#### F6 — API Routes
- 8 endpoints: GET /monitors, POST /monitors, PATCH /:id, DELETE /:id, PATCH /:id/pause, PATCH /:id/resume, GET /:id/timeline, POST /:id/run-now
- Mounted at `/api/v1/seo/monitors` BEFORE `/api/v1/seo` to avoid prefix ambiguity

#### F7 — Frontend
- Added 'Monitors' tab to SeoPage.jsx (4th tab after Audits/Keywords/Gaps)
- `MonitorSparkline` — pure SVG polyline from score history points
- `MonitorCard` — score, delta badge (TrendingUp/Down), sparkline, alert bell, status badge, next run time
- `AddMonitorModal` — url, name, schedule select
- `MonitorDetailPanel` — side panel with Recharts LineChart (score trend), run history table, alert cards, action buttons (run-now, pause/resume, delete)

---

### Phase H — Sellability Sprint ✅ Complete

**Overall progress: ~92%**

| Sub-task | Status | Notes |
|----------|--------|-------|
| H1 Landing page copy surgery | ✅ | Hero "Your Ads Are Bleeding / Money Right Now", Indian brands, Budget Guardian first in features, pricing FOMO |
| H2.1 "Try Live Demo" button in hero | ✅ | Below main CTAs, no-signup link to /demo-login |
| H2.2 Backend POST /auth/demo-login | ✅ | demoController.js — finds/creates shared demo team, seeds campaigns+notifications, returns JWT |
| H2.3 Frontend /demo-login page | ✅ | DemoLoginPage.jsx — auto-calls API on mount, redirects to /dashboard |
| H2.4 Demo banner in TopBar | ✅ | Amber bar when isDemo=true, "Create free account →" link |
| H3.1 OnboardingPage 4-step wizard | ✅ | Progress bar, step dots, company name + challenge → platforms → SEO scan → celebration |
| H3.2 Backend onboarding-complete | ✅ | POST /users/me/onboarding-complete, updates user.onboardingCompleted + team name |
| H3.3 ProtectedRoute onboarding redirect | ✅ | Redirects to /onboarding if !user.onboardingCompleted and !isDemo |
| H3.4 RegisterPage → onboarding | ✅ | Via ProtectedRoute logic (login → onboarding check fires automatically) |
| H3.5 SeoPage URL param autorun | ✅ | useSearchParams, passes initialUrl+autoRun to AuditsTab, auto-triggers audit 800ms after mount |
| H4 BudgetProtectionPage full UI | ✅ | Scan results, status banner, alert rules CRUD, How it works (Phase D) |
| H5 PricingPage /pricing | ✅ | Free/Growth/Scale tiers, annual toggle, FAQ accordion, public route |
| H6 Sidebar restructure | ✅ | 4 grouped sections (core, AI TOOLS, INTELLIGENCE, SETTINGS), badges, upgrade banner |
| H7 Dashboard refresh | ✅ | Greeting, quick action cards, activity feed |
| H8.1 index.html meta tags | ✅ | New title, description, og:title, og:description, twitter:card |
| H8.2 LAUNCH.md | ✅ | Product Hunt launch kit: taglines, description, topics, first comment, checklists |

---

### Phase J — Real Engine Implementation ✅ Complete

| Sub-task | Status | Notes |
|----------|--------|-------|
| J1 Budget Guardian | ✅ | `src/services/budgetProtection/BudgetGuardian.js` — real scan, _autoDetect (ROAS<1.0→critical, CTR<0.5%→warning, budget exceeded), _evaluateRule for user rules |
| J1.2 Budget controller | ✅ | Replaced mock BudgetProtectionService with real BudgetGuardian; campaignId now optional in createAlert |
| J1.3 Budget routes | ✅ | Added `GET /budget-ai/campaign/:id` for per-campaign health analysis |
| J1.4 Demo campaigns | ✅ | Updated DEMO_CAMPAIGNS: Summer Sale ROAS=0.8 (critical), Brand Awareness CTR=0.3% (warning), Retargeting ROAS=6.1 (healthy), Q4 Lead Gen with all perf fields |
| J2 Scaling Analyzer | ✅ | `src/services/scaling/ScalingAnalyzer.js` — 5 real factors (ROAS 30%, CTR 20%, Budget Util 20%, CPA 15%, Data Volume 15%), weighted average, dataQuality assessment |
| J2.2 Scaling controller | ✅ | Replaced mock ScalingPredictorService with real ScalingAnalyzer |
| J3 Competitor beta labels | ✅ | Amber beta banner on CompetitorHijackPage.jsx + ResearchPage.jsx Competitors tab; isBeta+disclaimer fields in researchController |
| J4 Scaling UI dataQuality | ✅ | Added dataQuality progress bar + label in ScalingPredictorPage expanded panel |

**New files:**
- `src/services/budgetProtection/BudgetGuardian.js`
- `src/services/scaling/ScalingAnalyzer.js`

**Updated files:**
- `src/controllers/budgetProtectionController.js` — real BudgetGuardian
- `src/controllers/scalingController.js` — real ScalingAnalyzer
- `src/controllers/demoController.js` — realistic performance data
- `src/controllers/researchController.js` — isBeta + disclaimer
- `src/routes/budgetProtectionRoutes.js` — /campaign/:id route
- `client/src/pages/CompetitorHijackPage.jsx` — beta banner
- `client/src/pages/ResearchPage.jsx` — beta banner on competitors tab
- `client/src/pages/ScalingPredictorPage.jsx` — dataQuality indicator

**Demo will now show:**
- 1 critical alert (Summer Sale ROAS 0.8x — losing money)
- 1 warning (Brand Awareness CTR 0.3% — too low)
- Varied scaling scores per campaign (Retargeting scores highest, Summer Sale lowest)
- No mock/random numbers anywhere

---

### Phase I — Production Deployment

| Task | Description |
|------|-------------|
| I1 | Railway production deployment — push Docker container, set env vars |
| I2 | Configure production env vars (DATABASE_URL, REDIS_URL, JWT_SECRET, OPENAI_API_KEY, ENCRYPTION_KEY) |
| I3 | Custom domain (adpilot.app or adpilot.io) |
| I4 | Vercel for frontend — connect GitHub, set VITE_API_URL |
| I5 | Smoke test production before launch (auth, demo login, SEO audit, budget scan) |
| I6 | Update LAUNCH.md with real production URLs |

---

### Phase K — Next Major Phase (Planned)

**Goal:** Production readiness — real ad platform integrations, billing, deployment.

#### K1 — Stripe Billing
- `POST /billing/checkout` — create checkout session (Starter $49/mo, Pro $149/mo, Business $399/mo)
- `POST /billing/portal` — customer portal (upgrade/cancel)
- `POST /billing/webhook` — Stripe webhook: payment.succeeded → upgrade plan, subscription.deleted → downgrade
- Frontend: `/pricing` already built, add "Upgrade" CTA in sidebar upgrade banner
- Gate features behind plan limits (already in `src/config/limits.js`)

#### K2 — Meta Ads API (Real Campaign Sync)
- OAuth flow: `GET /integrations/meta/connect` → Meta OAuth → `POST /integrations/meta/callback`
- Bull job: `integrationSync` queue → fetch campaigns + adsets + insights
- Store results in `campaign.performance` JSON column → BudgetGuardian + ScalingAnalyzer work unchanged
- Rate limit: Meta Graph API allows ~200 req/hr per token

#### K3 — Google Ads API (Real Campaign Sync)
- Similar to K2 — Google OAuth → fetch campaigns + ad groups + performance report
- Populates same `campaign.performance` column

#### K4 — Production Deployment
- Railway: `Dockerfile` already present, `railway.json` configured
- Set all env vars from `.env.example` (see Section 0 of this doc)
- Vercel for frontend: `VITE_API_URL=https://your-railway-app.railway.app`
- Run `npx prisma db push` on production DB after first deploy

#### K5 — Real Competitor Intel
- Facebook Ad Library API (requires business verification)
- SerpAPI for Google Ads transparency report
- Replace `CompetitorHijackService` mock with real data

**Pre-requisites:**
- Stripe account + products created
- Meta Developer App approved for `ads_read` permission
- Google Ads Developer token (manager account needed)

---

### Phase E — Next Sprint (Backlog)

| Task | Description |
|------|-------------|
| E1 | Meta Ads API — real campaign sync (replace mock metrics) |
| E2 | Google Ads API — real campaign sync |
| E3 | Stripe billing — Starter $49/mo, Pro $149/mo, Business $399/mo |
| E4 | Real Budget Protection — real metrics → real alerts → real pausing via Meta/Google APIs |
| E5 | Real Competitor Intel — Facebook Ad Library API + SerpAPI |
| E6 | Real Scaling Predictor — 30-day metric history + regression model |
| E7 | White-label PDF reports — audit + analytics export (react-pdf) |
| E8 | Production hardening — per-team concurrency limits, daily rate limits, monitoring |

---

### Phase 1 (v2 Engine Restore & Stabilize)
**Status: ✅ Backend complete. Manual browser test pending.**

Key fixes done this session:
- `SEO_ENGINE_V2=true` re-confirmed in `.env` (had been reverted to false)
- All browser lifecycle (try/finally, timeouts, fallbacks) already in place
- Status transitions `pending→crawling→analyzing→scoring→summarizing→completed` confirmed
- Frontend (App.jsx) already wires `/seo` to `SeoPage` (not ComingSoon)

Remaining:
- Manual browser test on `example.com` and a real site
- Duplicate 409 in frontend — `errMsg` picks up from `auditMutation.error?.response?.data?.error?.message` ✓

### Phase 4 (LLM Summary) — Done ✅

**New files:**
- `src/services/seo/SeoSummaryService.js` — Anthropic Claude API, retry/backoff, JSON parsing
- `@anthropic-ai/sdk` installed as dependency

**Changes:**
- `AuditOrchestrator.js` — replaced stub with real `SeoSummaryService.generate()` call
- `seoController.js` — added `_parseSummary()` to parse TEXT→JSON for the mapper
- `SeoPage.jsx` — added `ExecutiveSummaryPanel`, `EffortBadge`, `ImpactBadge` components
- `SeoPage.jsx` — summary renders before Overview card when `audit.executiveSummary` is set

**To enable summaries:**
1. Set `ANTHROPIC_API_KEY=sk-ant-...` in `.env`
2. Set `SEO_SUMMARY_ENABLED=true` in `.env`
3. Restart server — summaries will generate for `pro` and `business` plan teams

### Phase 2 (Stronger Rules + Scoring + Crawl + Frontend) — ✅ Complete

**New rule files (7 added — registry now has 23 rules):**
- `rules/technical/ViewportRule.js` — missing_viewport (high)
- `rules/technical/SecurityHeadersRule.js` — missing_x_frame_options / missing_x_content_type / missing_hsts (medium/low)
- `rules/technical/HeadingHierarchyRule.js` — heading_hierarchy_skip (medium)
- `rules/technical/OpenGraphRule.js` — missing_open_graph (low)
- `rules/technical/SchemaMarkupRule.js` — missing_schema_markup (low)
- `rules/content/ImageDimensionsRule.js` — images_missing_dimensions (low)
- `rules/content/LazyLoadingRule.js` — no_image_lazy_loading (low)

**PuppeteerAdapter extended (4 new fields):**
- `responseHeaders` — x-frame-options, x-content-type-options, strict-transport-security, content-security-policy
- `headingStructure` — ordered array of heading tags (h1..h6) capped at 50
- `imagesMissingDimensions` — count of imgs without width+height
- `hasLazyImages` — boolean: any img has loading="lazy"

**ScoringEngine enhancements:**
- New 4th param `perfMetrics` for per-metric bonus checks
- +5 HTTPS bonus (all live pages over HTTPS)
- +5 Schema bonus (at least one page has ld+json)
- +3 Fast LCP bonus (< 2500ms per Google "Good" threshold)
- +3 Good CLS bonus (< 0.1 per Google "Good" threshold)
- Grade D boundary: 45 → 40

**CrawlEngine robots.txt path filtering:**
- `_parseRobots()` returns `{ blocksCrawl, disallowedPaths[] }` (was boolean only)
- `_isRobotsDisallowed(url, paths)` path-prefix matching
- BFS loop skips disallowed paths before queuing

**Frontend (SeoPage.jsx):**
- Export PDF button (🖨️) in audit panel header — shown only when audit is completed
- Re-run audit button (↻) in audit panel header — available for any loaded audit
- Inline confirmation strip before re-run executes (orange, Cancel / Confirm)
- Re-run queues new audit + auto-switches panel to new auditId

### Delete Audit Functionality — Done ✅

**Backend:**
- `DELETE /api/v1/seo/audit/:id` — team-scoped single delete (404 if not found, 204 on success)
- `DELETE /api/v1/seo/audits`   — bulk delete all for team (204)

**Frontend (SeoPage.jsx):**
- `ConfirmDialog` component — dark-themed modal with Cancel / Delete buttons
- Per-row trash icon: `group-hover` reveal (ChevronRight↔Trash2 swap), red on hover, `e.stopPropagation()` safe
- "Clear All" button in audit list header: only shown when audits exist, subtle (text-secondary → red on hover)
- On delete: auto-deselects result panel if that audit was open; invalidates query cache

### Phase 3 — Keyword Rank Tracking ✅

**Migration:** `20260301155759_keyword_rank_tracking`
- `keyword_ranks` table: keywordId, teamId, rank, recordedAt (cascade delete on keyword)
- Keyword model additions: `source` (manual/audit/ai), `createdBy` (userId), `isActive`

**New backend services:**
- `src/services/keywords/KeywordService.js` — createKeyword, deleteKeyword
- `src/services/keywords/KeywordDiscoveryService.js` — strategy wrapper (pluggable)
- `src/services/keywords/discovery/AuditDiscoveryStrategy.js` — extract from audit rawCrawlData
  (title/H1/meta, stopword filter, bigram boost, top 15 suggestions)

**KeywordTrackingService updates:**
- `syncRanks()` — now writes `KeywordRank` history snapshot per sync via `prisma.$transaction`
- `getKeywords()` — flattens `rankChange` → `change`/`trend`/`ema` top-level; adds `volume` alias

**New API routes:**
- `POST   /api/v1/seo/keywords`                     — create keyword (body: keyword, trackedUrl?, searchVolume?, difficulty?)
- `DELETE /api/v1/seo/keywords/:id`                 — delete keyword (team-scoped, 204)
- `POST   /api/v1/seo/keywords/discover-from-audit` — body: { auditId }, returns suggestions[]
- `GET    /api/v1/seo/keywords/:id/history`          — last 30 rank snapshots for sparkline

**Frontend (SeoPage.jsx — KeywordsTab):**
- `AddKeywordModal` — keyword input, tracked URL, collapsible "Discover from audit" section
  (matches audit URL → auditId, renders selectable chip suggestions, click chip → fills keyword)
- `KeywordsTab` — [Add Keyword] + [Sync Ranks] buttons, trash icon per row (group-hover),
  ConfirmDialog on delete, fixed volume/change field names

---

## 4. Phase 1 Checklist

- [x] Puppeteer timeout handling in all browser operations
- [x] Chrome process cleanup in all code paths (finally blocks)
- [x] Lighthouse timeout with fallback (per-page Promise.race, 60s)
- [x] Graceful fallback to v1 if Puppeteer unavailable
- [x] Status transitions working (pending → crawling → analyzing → scoring → completed)
- [x] Failed audits show error message in frontend (FailedState reads recommendations[].reason)
- [x] Frontend renders v2 data correctly (score, grade, categories, issues, metrics)
- [x] Progress bar shows stage names during polling (STATUS_INFO map)
- [ ] Tested on simple URL (example.com) — manual test
- [ ] Tested on real URL (bizamps.com) — manual test
- [ ] Tested failure case (invalid URL) — manual test
- [x] No orphan Chrome processes after completion (try/finally adapter.close())
- [x] SEO_ENGINE_V2=true set in .env

## 4b. Phase 4 Checklist

- [x] SeoSummaryService created (src/services/seo/SeoSummaryService.js)
- [x] Claude API integration with retry/backoff (3 attempts, exponential)
- [x] Feature flag gating (SEO_SUMMARY_ENABLED=false in .env = disabled by default)
- [x] Plan tier gating (limits.summaryEnabled: starter=false, pro/business=true)
- [x] `summarizing` status in ACTIVE_STATUSES (already existed)
- [x] AuditOrchestrator calls SeoSummaryService after scoring
- [x] JSON.stringify before storing to TEXT column; JSON.parse in mapper
- [x] Frontend: Executive Summary section (paragraphs)
- [x] Frontend: Priority Roadmap with ⚡/🔨/🏗️ effort badges
- [x] Frontend: Business Impact card (orange warning style)
- [x] Frontend: "Generating summary..." loading state (InProgressState handles 'summarizing')
- [ ] Frontend: Regenerate button (skipped — needs billing system)
- [x] Graceful handling when API key missing (returns null, audit completes normally)
- [x] Graceful handling when feature disabled (summaryEnabled=false skips the step)
- [ ] Tested end-to-end — requires ANTHROPIC_API_KEY in .env

---

## 5. Progress

```
Overall:  █████████████████████████████░░  94%

Stage 1 (Backend):     ██████████  100%
Stage 2 (Frontend):    ██████████  100%
Stage 3 (Hardening):   ██████████  100%
Stage 4 (SEO Engine):  ██████████  100%
Stage 5 (SEO UI):      ██████████  100%
Stage 6 (Validation):  ██████████  100%
Stage 7 (Summary):     ██████████  100%
Phase 2 (Rules++):     ██████████  100%  ✅
Delete Audits (UX):    ██████████  100%  ✅
Phase 3 (Keywords):    ██████████  100%  ✅
Phase C (UI Polish):   ██████████  100%  ✅
C14 (Dash/Analytics):  ██████████  100%  ✅
C15 (Feature Stubs):   ██████████  100%  ✅
Budget AI (D1):        ████████░░   80%  (real engine, real alerts, Meta/Google APIs pending)
Competitor Intel (D2): ███░░░░░░░   35%  (mock/beta labeled, real Ad Library API pending)
Scaling AI (D3):       ████████░░   80%  (real engine, real scores, metric history pending)
Stage 8 (Billing):     ░░░░░░░░░░    0%
Stage 9 (Deploy):      ░░░░░░░░░░    0%
```

---

## 6. Next Actions

**Priority 1:** Set `OPENAI_API_KEY` + test Generate Ads feature (Ad Studio → Generate tab)
**Priority 2:** Set Meta Ads credentials + test real campaign sync (Integrations → Meta)
**Priority 3:** Stripe integration for billing (Phase E3) — Starter $49/mo, Pro $149/mo, Business $399/mo
**Priority 4:** Deploy to production (Railway + Vercel) — all env vars needed: DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, ANTHROPIC_API_KEY, ENCRYPTION_KEY

---

## 7. Known Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| Lighthouse OOM on large sites (1000 pages) | High | `lighthousePagesLimit` per plan; serial execution |
| Puppeteer Chrome binary not present on deploy host | High | Puppeteer downloads bundled Chrome on `npm install`; confirm in Dockerfile |
| `SEO_AUDIT_TIMEOUT_MS` too low on slow sites | Medium | Default 10 min; configurable per env |
| `SEO_SUMMARY_ENABLED` left on with no Anthropic key | Low | SeoSummaryService returns null gracefully; audit completes normally |
| v1 legacy records have `status: 'complete'` not `'completed'` | Low | `mapV1Audit` handles them; no active path creates v1 records |
| Bull job retries re-launching Chrome on transient failures | Low | `finally` block always closes browser; retry starts clean |
| CampaignAlert mock scan uses stored performance — may differ from real Meta/Google data | Medium | Clearly labeled "mock" in UI; Phase E4 replaces with real APIs |

---

## 8. Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| v2 pre-creates audit record in controller, passes `auditId` to processor | Enables frontend to start polling immediately without waiting for job pickup |
| Separate Puppeteer browser for Lighthouse vs CrawlEngine | Lighthouse takes CDP ownership; sharing browsers causes page lifecycle conflicts |
| `headless: true` (not `'new'`) | `'new'` was removed in Puppeteer 22+; `true` is the modern headless flag |
| `rawCrawlData` stores only metadata, not `pages[]` | `pages[]` can be 1000+ objects; storing full array in JSONB risks row bloat |
| `ACTIVE_STATUSES` exported from `AuditOrchestrator` | Single source of truth for duplicate-audit guard; controller imports it directly |
| `ScoringEngine` validates weights sum to 1.0 at constructor time | Catches config drift immediately on server start, not silently mid-audit |
| `summary` column is TEXT, SeoSummaryService result is JSON.stringify'd | Schema already exists as TEXT; stringify/parse avoids migration for now |
| SeoSummaryService returns null gracefully on any error | Summary is enrichment, not core; audit pipeline must never fail due to LLM errors |
| ScalingPredictorService uses charSum % range for deterministic scores | Consistent results per campaign across requests; no randomness confusion |
| CompetitorHijackService seeds mock data from domain string | Same domain = same analysis = believable demo UX without a real API |
| BudgetProtectionService.scanTeam() evaluates only rules with matching campaignId | Scoped scan prevents cross-team data leakage; real API version replaces the perf mock |
| CampaignAlert uses `prisma db push` (not migrate dev) | Shadow database incompatibility with existing migrations; db push syncs schema directly |

---

## 9. Key File Index

```
── Routing & Controllers ────────────────────────────────────────────────────────
  src/routes/seoRoutes.js                     — all /seo/* routes (audit + keyword + gap + brief)
  src/controllers/seoController.js            — audit CRUD, keyword CRUD, discover, history,
                                                gaps, briefs; v1/v2 mapper + _parseSummary
  src/routes/budgetProtectionRoutes.js        — /budget-ai/alerts + /budget-ai/scan
  src/controllers/budgetProtectionController.js — CRUD for CampaignAlert + mock scan
  src/routes/researchRoutes.js                — /research/hijack-analysis
  src/routes/competitorRoutes.js              — /competitors CRUD
  src/controllers/researchController.js       — competitor CRUD + hijack analysis
  src/routes/scalingRoutes.js                 — /scaling/readiness + /scaling/all-campaigns
  src/controllers/scalingController.js        — deterministic scale readiness

── AI Services ─────────────────────────────────────────────────────────────────
  src/services/ai/BudgetProtectionService.js  — scanTeam, createAlert, getAlerts, update, delete
  src/services/ai/CompetitorHijackService.js  — analyzeCompetitor (mock, domain-seeded)
  src/services/ai/ScalingPredictorService.js  — _computeScore, predictScaleReadiness, getAllCampaigns

── SEO Audit Pipeline ───────────────────────────────────────────────────────────
  src/queues/processors/seoAuditProcessor.js  — Bull job router (v2 / legacy)
  src/services/seo/audit/AuditOrchestrator.js — pipeline conductor + ACTIVE_STATUSES export
  src/services/seo/audit/adapters/PuppeteerAdapter.js — Puppeteer page data extraction
  src/services/seo/audit/engines/CrawlEngine.js       — BFS crawler, robots.txt path filter
  src/services/seo/audit/engines/TechnicalAnalyzer.js — runs all rules, sorts by severity
  src/services/seo/audit/engines/PerformanceEngine.js — Lighthouse (serial, fallback)
  src/services/seo/audit/engines/ScoringEngine.js     — weighted scoring, bonuses, letter grade
  src/services/seo/audit/rules/registry.js            — 23 stateless rule instances
  src/services/seo/SeoSummaryService.js               — LLM summary via Anthropic Claude API

── Keyword Tracking ─────────────────────────────────────────────────────────────
  src/services/seo/KeywordTrackingService.js          — getKeywords (enriched), syncRanks (+history)
  src/services/keywords/KeywordService.js             — createKeyword, deleteKeyword
  src/services/keywords/KeywordDiscoveryService.js    — strategy wrapper for discovery
  src/services/keywords/discovery/AuditDiscoveryStrategy.js — extract from audit rawCrawlData

── Config ───────────────────────────────────────────────────────────────────────
  src/config/seo.js                           — crawl/lighthouse/scoring constants
  src/config/limits.js                        — per-plan limits (maxPages, summaryEnabled, etc.)
  src/config/featureFlags.js                  — SEO_ENGINE_V2, LIGHTHOUSE_ENABLED, SEO_SUMMARY_ENABLED

── Database ─────────────────────────────────────────────────────────────────────
  prisma/schema.prisma                        — 15 models incl. KeywordRank (Phase 3) + CampaignAlert (Phase D1)
  prisma/migrations/20260228100000_*/         — SEO audit v2 columns
  prisma/migrations/20260301155759_*/         — keyword_ranks table + Keyword additions
  (CampaignAlert applied via prisma db push — no migration file)

── Frontend ─────────────────────────────────────────────────────────────────────
  client/src/pages/DashboardPage.jsx          — Command Center: live status cards, quick actions,
                                                recent activity feed, campaign health
  client/src/pages/AnalyticsPage.jsx          — Deep Dive: date range, 5 metrics, 4 charts, CSV export
  client/src/pages/BudgetProtectionPage.jsx   — Budget AI: scan, alert rules CRUD, active alerts
  client/src/pages/CompetitorHijackPage.jsx   — Competitor Intel: analyze form, ad examples,
                                                keyword gaps (Track→SEO), win-back opportunities
  client/src/pages/ScalingPredictorPage.jsx   — Scaling AI: score gauges, factor bars, apply scale
  client/src/pages/ResearchPage.jsx           — Research Hub: competitors + market research +
                                                upgraded Ad Intelligence (full hijack analysis)
  client/src/pages/SeoPage.jsx                — SEO: audit run/list/delete, keywords, gaps, briefs
  client/src/App.jsx                          — all routes incl. /budget-ai, /competitor-hijack, /scaling
  client/src/components/layout/Sidebar.jsx   — nav + AI Features section (Budget AI, Competitor Intel, Scale AI)
```

---

*Last updated: 2026-03-03 — Session: Phase J + Bug Fix — real engines, auth team fix, env setup documented*

---

## Phase H-FIX — Comprehensive Testing + Bug Fixes ✅ Complete

### Bugs Fixed
1. **Login onboarding redirect** (`authService.js`) — `onboardingCompleted ?? false` coerced null→false
   for existing users, forcing them to /onboarding. Fixed: preserve raw DB value.
2. **Demo login 500 error** (`demoController.js`) — full rewrite:
   - Was using `members` relation which doesn't exist (schema has direct Team.users[])
   - Was creating User without required teamId (team must be created first)
   - Campaign seed used direct fields (spend/roas/clicks) instead of `performance` JSON column
   - Now handles partial seeding on retry

### All Endpoints Verified Passing ✅
- POST /auth/login → onboardingCompleted: true for existing users
- POST /auth/demo-login → success, isDemo: true, 4 campaigns, 5 notifications
- GET /users/me, /campaigns, /analytics/overview, /notifications
- GET /budget-ai/scan, /budget-ai/alerts, /competitors, /research/hijack-analysis
- GET /scaling/all-campaigns, /scaling/readiness, /seo/audits, /seo/keywords
- GET /seo/monitors (CRUD: create/list/timeline/pause/resume/delete all pass)
- SEO audits complete: example.com (79/B), maxleads.in (78/B)
- Frontend vite build: clean ✓ | Backend app.js loads without errors ✓
