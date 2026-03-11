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
| **16** | **Phase K: Feature Identity System + UI Premium** | **✅ Complete** |
| **17** | **Phase L1: Responsive UI (mobile/tablet/desktop)** | **✅ Complete** |
| **18** | **Phase G: Replace Mock Data with Real Data** | **✅ Complete** |
| **19** | **Phase N: Landing Page Visual Polish (dot grid, shooting stars, pipeline timeline)** | **✅ Complete** |
| **20** | **Phase P: Free Feature Implementation + Architecture Hardening** | **✅ Complete** |
| **21** | **Phase Q: Premium Experience Sprint (dashboard command center, report modal, bulk audit, CSV exports)** | **✅ Complete** |
| 9 | Payments / billing integration | ⏳ Pending |
| 10 | Production deployment | ⏳ Pending |

---

## 3. Current Stage — Enhancement Phases

### Session Update — March 10, 2026

**Production hardening completed this session:**

| Item | Status | Notes |
|------|--------|-------|
| SEO executive summary provider rollback | ✅ | `SeoSummaryService` now uses Anthropic first, with Ollama fallback instead of Gemini-only generation |
| VPS production deploy | ✅ | Live `adpilot-app` rebuilt on `194.163.146.149` from commit `2bbca7fd` without overwriting unrelated server-side compose/nginx changes |
| Executive summary on VPS | ✅ | Live audit completed with stored summary payload and provider=`anthropic` |
| Market Research persistence | ✅ | Results now save into `research_reports` and reload from `/api/v1/research/reports/latest?kind=market` |
| Ad Intelligence persistence | ✅ | Results now save into `research_reports` and reload from `/api/v1/research/reports/latest?kind=ad-intelligence` |
| 24-hour research retention | ✅ | Market Research and Ad Intelligence reports are pruned after 24 hours on save/load |

**Notes:**
- Research tab-switch loss was caused by local component state only. Persistence now exists on both backend and frontend.
- SEO summary payload currently comes back as a structured object (`executiveSummary`, `priorityRoadmap`, `businessImpact`) and is rendering correctly on the live app.

### Session Update — March 10, 2026 (Intelligence Overhaul Pass)

| Item | Status | Notes |
|------|--------|-------|
| Keyword Research upgrade | ✅ | ValueSERP-backed SERP context, trend delta, intent/difficulty/opportunity analysis, SERP feature output |
| Content Brief upgrade | ✅ | Brief generation now uses top-ranking SERP pages, headings, word counts, related searches, and People Also Ask |
| Radar vs Pulse differentiation | ✅ | Research overview and attack-plan modes now diverge at the service/controller layer |
| Market Research output quality | ✅ | Added threat level, topical coverage, and richer competitive context from live crawl + SERP enrichment |
| Sentinel improvements | ✅ | Scan now returns spend summary, CPA/velocity, anomaly list, and auto-seeds sensible default rules |
| Forge scoring improvements | ✅ | Ad variations now use deterministic relevance / emotion / CTA / uniqueness scoring instead of random quality scores |
| Reports upgrade | ✅ | Report payload now includes executive summary, SEO health breakdown, keyword table, competitor matrix, content recommendations, and action plan sections |
| VPS verification | ✅ | Live checks passed for keyword research, content briefs, Sentinel scan, ad generation, and report generation on commit `9fd42c7e` |

**Still pending:**
- No major backlog remains from Sessions 2-5. Remaining work is incremental refinement and broader regression testing, not core implementation.

### Session Update — March 10, 2026 (Final Polish Pass)

| Item | Status | Notes |
|------|--------|-------|
| Sentinel action fix | ✅ | Budget protection "Apply Fix" now calls `/api/v1/budget-ai/apply-fix` instead of the wrong campaign endpoint |
| Competitor Hijack inline error state | ✅ | Added recoverable inline error card with retry action |
| SEO Monitors error state | ✅ | Added non-blank fallback card when monitor fetch fails |
| Global server error wording | ✅ | Backend no longer returns raw "Internal server error" message to users |
| ErrorBoundary recovery CTA | ✅ | Added "Check Settings" path in the global React error boundary |
| VPS verification | ✅ | Live Sentinel pause action verified on scanned alert for campaign `Summer Sale — Meta` |

### Session Update — March 11, 2026 (Content Brief Runtime Verification)

| Item | Status | Notes |
|------|--------|-------|
| Content brief schema sync root cause | ✅ | Local runtime verified against synced Prisma schema; the prior `P2022` brief failure was caused by missing `content_briefs` columns in environments that had not applied the newer schema |
| Content brief legacy-schema tolerance | ✅ | `ContentBriefService` now falls back safely when rich brief columns are unavailable instead of crashing on list/save |
| Local brief list verification | ✅ | Authenticated `GET /api/v1/seo/briefs` returned `200` with saved brief data |
| Local brief creation verification | ✅ | Authenticated `POST /api/v1/seo/briefs` returned `201` and created a new brief with `source=anthropic` |
| Local dev runtime | ✅ | Backend confirmed healthy on `http://localhost:3000`; frontend dev server confirmed on `http://localhost:5173` |

**Notes:**
- Prisma schema is already in sync locally after verification with `npx prisma db push`.
- Any environment that still throws content-brief `P2022` errors must apply the same schema sync to its database before the rich brief fields can persist natively.

### Session Update — March 11, 2026 (Launch-Hardening: SEO + Ad Intelligence)

| Item | Status | Notes |
|------|--------|-------|
| SEO audit URL determinism | ✅ | Audit creation now canonicalizes URLs and reuses the latest audit for the same site by default instead of creating drift between `example.com`, `https://example.com/`, `www`, and trailing-slash variants |
| Explicit force-rerun flow | ✅ | Normal audit requests now prefer deterministic reuse; the UI rerun action now uses `?force=1` for a genuinely fresh crawl |
| Ad Intelligence provider cleanup | ✅ | Competitor analysis now uses Anthropic as the grounded AI layer for strategy output instead of multi-provider templated fallbacks |
| Fake win-back removal | ✅ | Win-back opportunities are now empty unless there is evidence-backed recovery context; UI shows a clear no-evidence note instead of generic filler |
| Competitor crawl fallback removal | ✅ | Research no longer returns mock/template competitor output when crawl data is unavailable; it now fails honestly so the marketer is not misled |
| SERP enrichment improvement | ✅ | Keyword enrichment now attempts to detect the competitor’s live position in SERP results for observed keywords |

**Launch lens:**
- `LAUNCH.md` makes Budget Protection the core story. Every supporting feature should reduce marketer vigilance and uncertainty, not add generic AI text.
- The app should prefer real evidence, explicit data gaps, and stable repeatable results over “always say something” behavior.

### Session Update — March 11, 2026 (Team-Memory RAG Layer)

| Item | Status | Notes |
|------|--------|-------|
| Shared team-memory retrieval layer | ✅ | Added `TeamContextService` to retrieve recent tracked keywords, briefs, audits, competitor research, and report context from Postgres for prompt grounding |
| Content Brief grounding | ✅ | Anthropic brief generation now includes team memory so briefs align with existing tracked topics, prior briefs, and recent audits instead of repeating generic structures |
| Keyword Research grounding | ✅ | Anthropic keyword insights now incorporate team memory and use a team-scoped cache key instead of cross-team generic cache reuse |
| Competitor analysis grounding | ✅ | Anthropic attack-plan generation now receives stored competitor history, tracked keyword overlap, prior research, and recent briefs as retrieval context |
| Report grounding | ✅ | Executive report summary now includes team memory from recent audits, research, briefs, and tracked keywords |
| Runtime verification | ✅ | Local verification passed for keyword research (`200`), content brief generation (`201`, `source=anthropic`), and report generation (`200`, structured executive summary + markdown present) |

**Design principle:**
- “Train Anthropic” in this product means retrieval-augmented generation with the team’s own data, not model fine-tuning.
- The live system should get sharper over time because the team memory gets richer, while outputs remain grounded in first-party data and current crawl/SERP evidence.

### Session Update — March 11, 2026 (AI Engine Hardening)

| Item | Status | Notes |
|------|--------|-------|
| Anthropic temperature bug fix | ✅ | `AnthropicService.generate()` now actually forwards the requested `temperature` to the Anthropic API instead of silently using provider defaults |
| Shared structured-response caching | ✅ | Added Redis-backed `AnthropicService.generateJSON()` so repeated structured prompts reuse the same parsed JSON instead of drifting between calls |
| Provider-level timeout control | ✅ | Anthropic requests now honor explicit `timeoutMs` values in the shared service rather than relying on each caller to wrap the request correctly |
| Lower-variance SEO outputs | ✅ | Content briefs, keyword research insights, SEO summaries, report summaries, and dashboard verdicts now use low-temperature structured generation for more stable outputs |
| Prompt-keyed cache rollout | ✅ | Shared prompt caches now back briefs, keyword research, SEO summaries, reports, and dashboard AI blocks so identical evidence returns the same answer faster |
| Local build verification | ✅ | `npm run build` and targeted module-load verification passed after the engine-layer changes |

**Why this matters:**
- The biggest source of “same input, different answer” drift was not only the models; it was also the service layer ignoring `temperature` and re-running structured prompts without a cache.
- Fixing that in one place is better than trying to patch each page separately, and it keeps the codebase closer to SOLID/service-layer design.

### Session Update — March 11, 2026 (Phase 1: Production Data-Layer Lockdown)

| Item | Status | Notes |
|------|--------|-------|
| Compose file alignment | ✅ | Replaced the stale checked-in compose file with the actual AdPilot production stack (`postgres`, `redis`, `adpilot-app`) so repo infra matches the live VPS deployment |
| Postgres public exposure removal | ✅ | Removed host-port publishing for Postgres from compose; DB is now intended to stay private to Docker networking only |
| Redis public exposure removal | ✅ | Removed host-port publishing for Redis as well so the cache layer is no longer reachable from the public internet |
| Service health gates | ✅ | Added Compose health checks for Postgres and Redis and made the app depend on healthy backing services |
| Restart policy hardening | ✅ | Added `restart: unless-stopped` across the production services so recovery is automatic after host/container restarts |

**Security note:**
- VPS logs showed active hostile SQL traffic against the exposed database port. Closing host access to Postgres is a real production security fix, not cleanup.
- Redis was also being published publicly and is now treated as an internal-only service for the same reason.

### Session Update — March 11, 2026 (Phase 2: Startup Flow Cleanup)

| Item | Status | Notes |
|------|--------|-------|
| Boot-time schema mutation removed | ✅ | Production Docker startup no longer runs `prisma db push --accept-data-loss` on every container boot |
| Dedicated DB readiness script | ✅ | Added `src/scripts/waitForDatabase.js` to block startup until Prisma can complete a real DB connection and `SELECT 1` |
| Startup responsibility separation | ✅ | Schema sync is now treated as an explicit operational step, while container boot is limited to dependency readiness + app start |

**Why this matters:**
- The previous image startup path mixed deployment/migration concerns with application boot, which is why the container showed the initial Prisma `P1000` noise and non-deterministic recovery behavior.
- This phase keeps boot predictable and makes DB schema changes a conscious action instead of a side effect of every restart.

**VPS verification:**
- The real production image definition was the root `Dockerfile`, not `src/Dockerfile`; both are now aligned.
- Live production logs now show `Database ready after 1 attempt(s)` before server startup.
- The old boot-time `prisma db push --accept-data-loss` path and initial Prisma `P1000` startup noise are no longer present.
- Production `/health` returned `200` after the redeploy.

### Session Update — March 11, 2026 (Phase 3: SERP Provider Hardening)

| Item | Status | Notes |
|------|--------|-------|
| Shared ValueSERP provider layer | ✅ | Added `SerpProviderService` so research enrichment and keyword rank tracking no longer maintain separate ValueSERP call logic |
| Redis-backed SERP response caching | ✅ | Successful ValueSERP responses are now cached centrally before downstream parsing so repeated lookups stay faster and more stable |
| ValueSERP cooldown / negative cache | ✅ | `402`, auth failures, and rate limits now create a cooldown window instead of hammering the provider and returning repeated silent nulls |
| Explicit degraded-state metadata | ✅ | Keyword research and competitor analysis paths now surface provider status metadata such as `missing_key`, `quota_exhausted`, `rate_limited`, or `degraded_cache` |
| Keyword tracking provider reuse | ✅ | `SerpService` rank checks now reuse the same hardened ValueSERP client before falling back to DuckDuckGo |
| Content brief SERP diagnostics | ✅ | Brief generation now logs the provider status when SERP context is unavailable, instead of treating all failures as indistinguishable nulls |

**Why this matters:**
- The previous behavior silently collapsed many ValueSERP failures into `null`, which made research features look broken or generic instead of honestly degraded.
- This phase keeps the engine deterministic: cached data is reused when safe, provider outages cool down centrally, and downstream services can explain what data is missing.

**Local verification:**
- Shared engine module load check passed for the updated SERP provider, SEO intelligence, keyword research, content briefs, and competitor analysis services.
- `npm run build` passed after the provider-layer changes.
- Forced degraded-state checks confirmed `missing_key` now returns explicit provider metadata instead of silent null behavior.

### Session Update — March 12, 2026 (Phase 4: Fallback Search Evidence Tightening)

| Item | Status | Notes |
|------|--------|-------|
| DuckDuckGo SERP fallback for research | ✅ | SEO keyword research and SERP intelligence now fall back to DuckDuckGo HTML result snapshots when ValueSERP is unavailable |
| Content brief evidence preservation | ✅ | Content briefs now keep using live top-result titles, URLs, snippets, and fetched headings even when the primary SERP API is degraded |
| Generic brief-outline suppression | ✅ | Brief normalization now drops template headings like “What is …” / “Beginner tips” when real competitor evidence exists and merges AI output with deterministic competitor-derived sections |
| Competitor rank-source enrichment | ✅ | Competitor keyword enrichment now carries `rankSource` so downstream attack vectors and keyword-gap evidence can distinguish ValueSERP vs DuckDuckGo-backed positions |
| Win-back grounding filter | ✅ | Competitor win-back opportunities are now discarded unless they map to an observed competitor keyword instead of generic recovery language |
| Prompt tightening for degraded paths | ✅ | Anthropic prompts for briefs and competitor analysis now explicitly state the search evidence source and require recommendations to stay anchored to observed keywords, CTAs, headings, and fallback data when necessary |

**What this fixes:**
- The real ValueSERP `402` still has to be solved at the provider/account level, but the app no longer falls back to thin or generic intelligence just because that upstream source is degraded.
- Content briefs and competitor intelligence now stay evidence-backed using crawlable search data, with stricter suppression of template output.

**Local verification:**
- Synthetic fallback check confirmed `SerpIntelligenceService` now returns a real fallback snapshot with `primaryStatus=missing_key` and `fallbackStatus=ok`.
- Brief-outline normalization check confirmed generic sections were removed in favor of competitor-derived headings.
- Win-back normalization check confirmed generic entries are rejected while keyword-grounded entries still pass.
- `npm run build` passed after the fallback evidence changes.

### Session Update — March 12, 2026 (Phase 5: VPS Deploy + Live Verification)

| Item | Status | Notes |
|------|--------|-------|
| VPS code sync | ✅ | Latest app changes through commit `1032d633` were packaged locally and synced onto the dirty VPS worktree without wiping unrelated server-only files |
| App rebuild on VPS | ✅ | `adpilot-app` was rebuilt and restarted successfully via Docker Compose on `194.163.146.149` |
| Live host/port verification | ✅ | App container is live on host `194.163.146.149` port `3001` and backend health returned `200 OK` |
| Keyword research live verification | ✅ | Live `/api/v1/seo/keywords/research` returned the new `providerStatus` structure showing `valueserp=quota_exhausted` and `organicFallback=unavailable`, proving the new degraded-state reporting is live |
| Content brief live verification | ✅ | Live `/api/v1/seo/briefs` generated successfully on VPS with `source=anthropic`, `outlineCount=10`, `peopleAlsoAskCount=6`, and `titleOptionsCount=5` |

**Deployment note:**
- The VPS Git worktree is still dirty and not safe for blind `git pull`, so deployment was done by syncing only the changed tracked files and rebuilding the app image.
- ValueSERP is still returning live `402` on the VPS, but the app now reports that honestly and keeps the rest of the flow running instead of failing silently.

### Session Update — March 12, 2026 (Phase 6: Research Dossier Architecture + RAG Surfacing)

| Item | Status | Notes |
|------|--------|-------|
| Research controller cleanup | ✅ | Research flows now route through a dedicated `ResearchOrchestratorService` and `ResearchReportRepository` instead of mixing persistence and orchestration inside the controller |
| Richer competitor crawl evidence | ✅ | `CompetitorAnalyzer` now collects hero copy, social links, structured-data types, internal-link surfaces, robots/sitemap signals, and a company snapshot in addition to headings/CTAs/tech stack |
| Radar dossier expansion | ✅ | Overview analysis now returns company snapshot, technical signals, content footprint, site surfaces, source matrix, evidence log, data gaps, and RAG context |
| Ad Intelligence dossier expansion | ✅ | Attack analysis now returns the same evidence framework plus richer source attribution, keyword rank-source metadata, and explicit data gaps |
| RAG surfaced in product output | ✅ | Team-memory overlap, prior research, owned keywords, and recent briefs/audits are now exposed in the response payload as `ragContext`, not hidden only inside the prompt |
| Research Hub UI richness pass | ✅ | Market Research and Ad Intelligence cards now render dossier-style sections for sources, company snapshot, evidence highlights, site surfaces, RAG context, and data gaps while preserving the existing visual language |

**Design intent:**
- The goal is no longer “crawl a site and ask AI to summarize it.”
- Research Hub is moving toward a reusable evidence dossier: crawl signals, search-provider status, team-memory retrieval, and strategic synthesis all visible as separate layers.
- This keeps the product more honest and more impressive at the same time: the richness comes from evidence density, not generic AI text.

**Local verification:**
- Module-load checks passed for the new repository/orchestrator/research services and updated research controller.
- `npm run build` passed after the Research Hub dossier and UI updates.

**VPS verification:**
- Phase 6 was deployed live to `194.163.146.149:3001` after commit `5a435e11`.
- Live Market Research run for `https://example.com` returned the new dossier fields, including `sourceMatrix`, `evidenceLog`, `dataGaps`, `siteSurfaces`, and `companySnapshot`.
- This confirms the Research Hub dossier layer is not only implemented locally; it is running on production now.

### Session Update — March 12, 2026 (Phase 7: Live Campaign Analyzer Foundation)

| Item | Status | Notes |
|------|--------|-------|
| Analyzer architecture split | ✅ | Added `CampaignIntelligenceRepository`, `CampaignSignalService`, `LiveCampaignAnalyzerService`, and `budgetAnalyzerController` so Sentinel now has a dedicated controller → service → repository path for campaign analysis |
| Cached analyzer endpoint | ✅ | Added `/api/v1/budget-ai/analyzer` with Redis-backed caching so the page can load a richer operator view without recalculating every panel on each request |
| Peer-baseline risk detection | ✅ | Campaign dossiers now use real stored metrics plus team peer baselines for ROAS, CTR, CPA, spend, and pacing instead of template copy or hardcoded history |
| Evidence-backed operator actions | ✅ | Each campaign now returns deterministic health scoring, evidence log, active protection rules, data gaps, and recommended actions like pause, budget trim, creative refresh, or tracking review |
| Sentinel UI dossier pass | ✅ | Budget Protection page now includes a Live Campaign Analyzer section with collapsible campaign dossiers, operator feed, pacing cards, evidence/signals, action blocks, and team-level data gaps while keeping the existing visual language |
| Budget report export upgrade | ✅ | Sentinel export now includes analyzer summary, operator feed, and campaign dossier tables instead of only the legacy alert-rule list |
| Rule-name alignment fix | ✅ | `BudgetGuardian` now evaluates both legacy rule names (`ctr_drop`, `spend_limit`) and live UI/controller names (`ctr_collapse`, `budget_bleed`) so alerts do not silently fail due to naming drift |

**Local verification:**
- Module-load checks passed for the new campaign analyzer repository/service/controller path and updated `BudgetGuardian`.
- `npm run build` passed after the Sentinel UI and analyzer changes.

**Open verification note:**
- A local runtime analyzer fetch was blocked because Postgres was not running on `localhost:5432` in the current shell, so this phase is implemented and build-verified locally but not yet deployed to VPS.
- Next step is commit → push → VPS deploy → live verification on `194.163.146.149:3001` after approval.

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
Overall:  ████████████████████████████████  98%

Stage 1 (Backend):          ██████████  100%
Stage 2 (Frontend):         ██████████  100%
Stage 3 (Hardening):        ██████████  100%
Stage 4 (SEO Engine):       ██████████  100%
Stage 5 (SEO UI):           ██████████  100%
Stage 6 (Validation):       ██████████  100%
Stage 7 (Summary):          ██████████  100%
Phase C (UI Polish):        ██████████  100%  ✅
Phase D (Killer Features):  ██████████  100%  ✅
Phase G (Real Data):        ██████████  100%  ✅
Phase K (Feature Identity): ██████████  100%  ✅
Phase L1 (Responsive):      ██████████  100%  ✅
Phase N (Landing Polish):   ██████████  100%  ✅
Phase P (Free Features):    ██████████  100%  ✅
  Ad Generate (real AI):    ██████████  100%  ✅
  Keyword Research:         ██████████  100%  ✅
  Competitor Analyze:       ██████████  100%  ✅
  Pulse Monitoring:         ██████████  100%  ✅
  Integration Status:       ██████████  100%  ✅
  Cache Layer + Timing:     ██████████  100%  ✅
Budget AI (D1):             ████████░░   80%  (Meta/Google platform API pending)
Competitor Intel (D2):      ██████░░░░   60%  (real crawl+AI, Ad Library API pending)
Billing (Stripe):           ░░░░░░░░░░    0%
Production Deploy:          ░░░░░░░░░░    0%
```

---

## 6. Next Actions

### Phase R — V2 Intelligence Engine Overhaul (Session 1: Crash Hardening) ⏳ In Progress (2026-03-10)

**Completed this session:**
- SEO executive summaries now use Gemini instead of Anthropic via `src/services/seo/SeoSummaryService.js`, matching the current AI architecture rule.
- Added `POST /api/v1/seo/audit/:id/regenerate-summary` in `src/controllers/seoController.js` + `src/routes/seoRoutes.js` so the frontend can retry missing summaries without rerunning the full audit.
- Beacon UI (`client/src/pages/SeoPage.jsx`) now shows a proper fallback card when a completed audit has no executive summary, plus a Retry Summary button.
- Market Research (`client/src/pages/ResearchPage.jsx`) now shows visible progress steps, spinner state, inline error state, and auto-scrolls to results after success.
- Error normalization improved in `src/middleware/errorHandler.js` so provider/env failures return operational JSON messages instead of a generic "Internal server error" where possible.
- Added `AppError.serviceUnavailable()` in `src/common/AppError.js` for provider/configuration failures.
- Deployment env visibility improved: `src/controllers/integrationController.js` now reports missing `GEMINI_API_KEY` and `VALUESERP_API_KEY`; `src/config/env.js` validates both variables.
- Fixed Budget Guardian schema mismatch: `CampaignAlert.campaignId` is now nullable in `prisma/schema.prisma` to match the controller/service logic for global alert rules.
- Regenerated Prisma Client after the schema change.

**Verification this session:**
- `npx prisma generate` ✅
- `npm run build` ✅
- Backend module load check for touched files ✅
- `npm test -- --runInBand` returned "No tests found" (repo currently has no Jest test suite)

**Remaining in Phase R:**
- Replace remaining Anthropic/OpenAI-first AI paths with Gemini-first/provider-safe flows (Forge, briefs, keyword analysis, competitor research).
- Improve VPS diagnostics further by exposing summary/provider failure reasons in the UI where useful.
- Continue Session 2 work: real ValueSERP-backed keyword research + SERP-informed content briefs.

### Phase M — API Verification + Bug Fixes ✅ Complete (2026-03-06)

**Bug fixed:** `src/middleware/validateZod.js` — `result.error.errors` was `undefined` in this Zod version (uses `result.error.issues`). Was causing 500 Internal Server Error on any strict-schema validation failure (ad generation, etc). Fixed to `result.error.issues ?? result.error.errors ?? []`.

**AnthropicService added:** `src/services/ai/AnthropicService.js` — Claude Haiku-4.5 integration for ad generation, content briefs, competitor analysis. Fourth in fallback chain (Ollama → Gemini → HuggingFace → Anthropic).

**All APIs verified real (no mock):**
| API | Source | Mock |
|-----|--------|------|
| Ad Generation `/campaigns/:id/ads/generate` | Ollama (local) | No |
| Content Brief `/seo/briefs` | Gemini (free) | No |
| Competitor Analysis `/research/hijack-analysis` | Real Puppeteer crawl + AI | No |
| Budget Protection `/budget-ai/scan` | Real BudgetGuardian | No |
| Scaling Predictor `/scaling/all-campaigns` | Real ScalingAnalyzer | No |
| All read endpoints (keywords, audits, rules, team, etc.) | DB | — |

**AI Cost:** Ollama runs first (free local), then Gemini (free tier), then HuggingFace (free), Anthropic only as last resort. SEO summaries use Claude directly (~$0.001 each). Set `SEO_SUMMARY_ENABLED=false` to disable.

### Phase Q — Full Fix Sprint ✅ Complete (2026-03-07)

**Railway deployment fixed:** `.dockerignore` was blocking `client/` from Docker build context (line 2 was `client`). Changed to `client/node_modules`. Dockerfile 2-stage build now works: Stage 1 builds React, Stage 2 copies `client/dist` into Express server.

**Pulse auto-detection:** PulseService now has `AUTO_RULES` that fire without user-configured `campaignAlerts` rules. Fires on: ROAS < 1.0x (critical), ROAS < 2.0x (warning), CTR < 0.5% (warning), CPA > $80 (warning). Demo team fires 2 alerts from Summer Sale (ROAS 0.80x + CTR 0.30%).

**Health score added to analytics overview:** `analytics/overview` now returns `health: {score, label, actionRequired}` + `actions[]` array with severity-tagged recommendations.

**Ad generate without campaignId:** `POST /api/v1/ads/generate` now works without a campaign — campaign is optional, falls back to `brief.platform || 'meta'`.

**Gaps message:** `CompetitorGapService.analyze()` returns `message` field explaining when 0 gaps found (no competitors tracked vs no data).

**Seed data:** Summer Sale demo campaign seeded with poor metrics (ROAS 0.8x, CTR 0.3%) so pulse auto-detection always has data to fire on.

**Priority 1:** Stripe billing — Starter $49/mo, Pro $149/mo, Business $399/mo (Phase E3)
**Priority 2:** Meta Ads OAuth + real campaign sync (META_ACCESS_TOKEN in .env → Integrations page)
**Priority 3:** Push to Railway (git push → Railway auto-deploys from main)
**Priority 4 (optional):** Groq API key (free, fastest LLM) — add `GROQ_API_KEY` to .env, wire `groq-sdk` into AI fallback chain before Anthropic

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

*Last updated: 2026-03-10 — Session: Phase R Session 1 — crash hardening, Gemini summary retry flow, market research UX fixes*

---

## Phase K — Feature Identity System + UI Premium ✅ Complete

### K0 Quick Fixes
- TopBar `routeTitles` extended to all 6 AI feature paths (Forge, Sentinel, Apex, Beacon, Pulse, Radar)
- Primary `.btn-primary` updated to always use `bg-gradient-to-r from-blue-600 to-purple-600`
- Added `.btn-ghost` utility class

### K1 Feature Identity Config
- Created `client/src/config/features.js` — single source of truth
- 6 features: **Sentinel** (red/Budget AI), **Apex** (amber/Scale), **Radar** (purple/Competitor), **Beacon** (cyan/SEO), **Forge** (orange/Ad Studio), **Pulse** (green/Research)
- Static `COLOR_MAP` with all Tailwind class strings (JIT-safe — no template literals)
- `FEATURE_LIST`, `FEATURE_BY_PATH` exports

### K1 Sidebar Update
- Feature codenames as primary labels, sublabels (e.g. "Budget Guardian")
- Badges: LIVE (red, animated dot) for Sentinel, AI (amber) for Apex, BETA (purple) for Radar
- Logo: A/P airplane SVG replacing Zap icon, "AI Command Center" subtitle

### K2 Shared UI Components
- `client/src/components/ui/Skeleton.jsx` — SkeletonLine, SkeletonCard, SkeletonKPI, SkeletonTable, SkeletonFeatureCard
- `client/src/components/ui/EmptyState.jsx` — feature-branded empty states with color prop
- `client/src/components/ui/FeatureHeader.jsx` — premium page header: gradient glow, icon ring, badge, stats row, actions

### K3 Feature Headers Applied
All 6 feature pages updated with `FeatureHeader`:
- BudgetProtectionPage → Sentinel (red, LIVE badge, 3 stats, Scan Now action)
- ScalingPredictorPage → Apex (amber, AI badge, 3 stats, Refresh action)
- CompetitorHijackPage → Radar (purple, BETA badge, 3 stats)
- SeoPage → Beacon (cyan, 3 stats)
- AdStudioPage → Forge (orange, 3 stats)
- ResearchPage → Pulse (green, 3 stats)

### K4 Mission Control Dashboard (SystemStatus)
- Added `SystemStatusPillar` grid (6 feature tiles, navigate on click) to Dashboard
- Updated Quick Actions to use feature codenames (Beacon, Forge, Sentinel)
- System status shows all 6 AI features with their feature colors

### K5 Command Palette
- Created `client/src/components/ui/CommandPalette.jsx`
- Triggered by ⌘K / Ctrl+K globally from `App.jsx`
- Fuzzy match across all 13 navigation targets
- Full keyboard navigation (↑↓ Enter ESC)
- Feature-colored icons + badges in results
- Search hint button added to TopBar

### K6 Micro-animations
- Page transitions: `page-enter` animation on route change (fade + slide up)
- `sentinel-pulse` — red pulsing glow for critical alerts
- `beacon-signal` — cyan breathing animation for SEO
- `apex-rise` — amber floating for scale predictor
- `count-up` — number reveal animation

### Files Changed
```
client/src/config/features.js                — NEW: feature identity config
client/src/components/ui/Skeleton.jsx        — NEW: skeleton loaders
client/src/components/ui/EmptyState.jsx      — NEW: branded empty states
client/src/components/ui/FeatureHeader.jsx   — NEW: premium page header
client/src/components/ui/CommandPalette.jsx  — NEW: ⌘K command palette
client/src/components/layout/Sidebar.jsx     — codenames, badges, LIVE dot, airplane logo
client/src/components/layout/TopBar.jsx      — routeTitles, ⌘K search hint button
client/src/components/layout/AppLayout.jsx   — page-enter animation on route change
client/src/pages/BudgetProtectionPage.jsx    — FeatureHeader (Sentinel) + EmptyState
client/src/pages/ScalingPredictorPage.jsx    — FeatureHeader (Apex) + EmptyState
client/src/pages/CompetitorHijackPage.jsx    — FeatureHeader (Radar)
client/src/pages/SeoPage.jsx                 — FeatureHeader (Beacon)
client/src/pages/AdStudioPage.jsx            — FeatureHeader (Forge)
client/src/pages/ResearchPage.jsx            — FeatureHeader (Pulse)
client/src/pages/DashboardPage.jsx           — SystemStatus 6-pillar grid, codename quick actions
client/src/App.jsx                           — CommandPaletteController (⌘K listener)
client/src/index.css                         — btn-primary gradient, btn-ghost, 4 keyframe animations
```

*Last updated: 2026-03-03 — Session: Phase K — Feature Identity System, Command Palette, Micro-animations, Premium Headers*

---

## Phase L1 — Responsive UI ✅ Complete

### Goal
Every page works perfectly on mobile (375px–767px), tablet (768px–1023px), and desktop (1024px+). Desktop layout unchanged.

### Changes Made

#### L1 — Sidebar (Sidebar.jsx)
- Mobile (<768px): slide-in drawer from left with overlay — unchanged behavior
- Tablet (768px–1023px): permanent icon-only sidebar, 56px wide (md:w-14)
  - Labels, sublabels, badges, team pill, upgrade banner hidden at md via `hidden lg:block`
  - Nav items center-aligned at md via `md:justify-center lg:justify-start`
  - User section shows avatar only at tablet
  - `title` attribute on NavLinks for tooltip on hover
- Desktop (1024px+): full 240px sidebar — unchanged
- Mobile overlay: `md:hidden` (only shows on mobile)

#### L2 — TopBar (TopBar.jsx)
- Hamburger button: `md:hidden` (not shown on tablet — sidebar is always visible)

#### L3 — AppLayout (AppLayout.jsx)
- Main padding: `p-3 sm:p-4 lg:p-6` (mobile-friendly smaller padding)

#### L4 — Dashboard (DashboardPage.jsx)
- KPI cards: `grid-cols-2 lg:grid-cols-4` (2-column on mobile/tablet, 4 on desktop)
- Quick actions: `gap-3 sm:gap-4` responsive gap

#### L5 — Campaigns (CampaignsPage.jsx)
- Mobile card list (`sm:hidden`): name, status badges, budget, created date, action buttons
- Desktop table (`hidden sm:block`): unchanged
- Mobile FAB (`sm:hidden fixed bottom-6 right-6`): floating + button for new campaign
- Toolbar "New Campaign" button: `hidden sm:flex` (FAB on mobile)

#### L6 — FeatureHeader (FeatureHeader.jsx)
- Top row: `flex-col sm:flex-row` — icon+text stacks on mobile, inline on sm+
- Actions: `sm:shrink-0` — doesn't force shrink on mobile

#### L7 — All Modals (12 modals across 10 files)
- Outer: `flex items-end sm:items-center justify-center` — bottom sheet on mobile
- Inner containers: `rounded-t-2xl sm:rounded-xl` — bottom corners sharp on mobile
- Width: `w-full sm:max-w-xxx` — full width on mobile

#### L8 — LandingPage (LandingPage.jsx + LandingPage.css)
- Added hamburger button with open/close state (`navOpen`)
- Mobile nav dropdown (`nav-mobile-menu`) — full-width links
- CSS updated:
  - `@media (max-width: 900px)`: pain-grid/pillar-grid → 2-col, nav-links hidden, hamburger shown, hero padding reduced, product preview hidden
  - `@media (max-width: 640px)`: all grids → 1-col, hero padding further reduced
  - Added hamburger animation keyframes (nav-ham-open-*)

### Files Changed
```
client/src/components/layout/Sidebar.jsx    — responsive sidebar (drawer→icon→full)
client/src/components/layout/TopBar.jsx     — hamburger md:hidden
client/src/components/layout/AppLayout.jsx  — responsive padding
client/src/components/ui/FeatureHeader.jsx  — mobile column stacking
client/src/pages/DashboardPage.jsx          — 2-col KPI grid
client/src/pages/CampaignsPage.jsx          — mobile cards + FAB
client/src/pages/BudgetProtectionPage.jsx   — bottom-sheet modal
client/src/pages/ScalingPredictorPage.jsx   — bottom-sheet modal
client/src/pages/SeoPage.jsx                — bottom-sheet modals (5)
client/src/pages/AdStudioPage.jsx           — bottom-sheet modal
client/src/pages/ResearchPage.jsx           — bottom-sheet modal
client/src/pages/RulesPage.jsx              — bottom-sheet modal
client/src/pages/IntegrationsPage.jsx       — bottom-sheet modal
client/src/pages/TeamPage.jsx               — bottom-sheet modal
client/src/pages/SettingsPage.jsx           — bottom-sheet modal
client/src/components/campaigns/CreateCampaignModal.jsx — bottom-sheet
client/src/pages/LandingPage.jsx            — hamburger nav
client/src/pages/LandingPage.css            — mobile media queries
```

*Last updated: 2026-03-03 — Session: Phase L1 — Fully Responsive UI*

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

---

## Phase G — Replace Mock Data with Real Data ✅ Complete

### Dockerfile Fix
- CMD changed from `migrate deploy || db push` to `npx prisma db push --accept-data-loss && node src/server.js`
- Railway deploys now always auto-sync schema

### G1 — Gemini AI Service
- `src/services/ai/GeminiService.js` — singleton, uses `gemini-2.0-flash` free tier
  - `generateAds()` — 3 ad variations with emotion/value/urgency angles
  - `generateContentBrief()` — SEO content brief with outline + meta
  - `analyzeCompetitor()` — keyword gaps, messaging angles, weaknesses, suggested counter-ads
  - `generateAuditSummary()` — executive summary for SEO audits
  - Gracefully returns null if GEMINI_API_KEY not set
- `src/services/adService.js` — `generateAdWithAI()` tries Gemini first, falls back to mock (labelled `isMock:true`)
- `src/services/seo/ContentBriefService.js` — tries OpenAI → then Gemini → then TF-IDF fallback
- `src/config/index.js` — added `geminiApiKey`, `valueSerpKey`
- `.env` + `.env.example` — `GEMINI_API_KEY`, `VALUESERP_API_KEY` entries with docs

### G2 — Real Competitor Crawl (Puppeteer)
- `src/services/ai/CompetitorAnalyzer.js` — Puppeteer crawl of any public site
  - Extracts: title, description, headings (H1-H3), CTAs, tech stack (25 patterns), keyword frequency
  - Resource blocking (images/fonts/media) for fast crawl
  - Honest about ad spend: `adSpend: null`, `adSpendNote` explains what needs paid API
- `src/services/ai/CompetitorHijackService.js` — complete rewrite
  - Real crawl via CompetitorAnalyzer → Gemini AI insights when available
  - Falls back to smart mock (labelled `crawlFailed: true`) if site blocks bots
  - Never fakes ad spend numbers
- `src/controllers/researchController.js` — removed `isBeta`/`disclaimer` wrapper, returns real data

### G3 — Real SERP Rank Tracking
- `src/services/keywords/SerpService.js` — ValueSERP API (50 free/month)
  - `getRank(keyword, domain)` → real Google position in India
  - `getRanks(keywords[], domain)` → bulk with 1.1s rate limiting
  - Returns `{isReal: false}` when API key not set
- `src/services/seo/KeywordTrackingService.js` — `syncRanks()` tries SerpService first, falls back to ±3 drift mock

### G5 — Budget Apply-Fix Endpoint (Real)
- `src/controllers/budgetProtectionController.js` — `applyFix()` handler
  - `pause` action: sets campaign.status = 'paused'
  - `reduce_budget` action: cuts budget by 30%
  - Creates notification in DB (non-blocking)
- `src/routes/budgetProtectionRoutes.js` — `POST /budget-ai/apply-fix` (admin/manager only)

### G8 — MockDataBanner Component
- `client/src/components/ui/MockDataBanner.jsx` — amber banner for data quality labelling
- `client/src/pages/CompetitorHijackPage.jsx` — complete rewrite:
  - Shows real crawl data: site title, description, headings, tech stack (colored badges), CTAs
  - Shows AI insights section only when `hasAiInsights: true`
  - Replaces fake "Ad Spend" with honest card: null + explanation
  - MockDataBanner shown when crawl fails or Gemini unavailable
  - Keyword track buttons on both topKeywords cloud and keywordGaps table

### New .env Variables
| Variable | Purpose | Get It |
|---|---|---|
| `GEMINI_API_KEY` | AI ad gen, briefs, competitor insights | https://aistudio.google.com/apikey (free) |
| `VALUESERP_API_KEY` | Real Google rank tracking | https://www.valueserp.com/ (50 free/mo) |

### Budget Protection + Scaling Predictor
- Both were already using real campaign data (BudgetGuardian + ScalingAnalyzer)
- No mock data was present — confirmed real from Phase J

---

## Phase N — Landing Page Visual Polish ✅ Complete (2026-03-06)

### N1 — Premium Visual Redesign (atozemails.com inspired)

**LandingPage.css** — complete visual system:
- `--bg-primary: #080810` dark base
- Per-section background patterns:
  - `.hero`: dot grid `radial-gradient(circle, rgba(255,255,255,0.088) 1px, transparent 1px) 28px 28px fixed`
  - `.pain`: line grid 60×60px
  - `.pillars`: sparse dot 40px
  - `.pipeline-section`: radial dark ellipse
  - `.pricing`: dense dot 20px
  - `.book-call`: indigo cross-grid 80px
  - `.cta-final`: diagonal stripe
  - footer: faint dot
- `.streak-canvas`: fixed canvas for static diagonal slashes + shooting star pool (z-index:1)
- `.mouse-glow`: 700px radial purple glow that follows cursor
- `.sec-glow` overlays per section for depth
- `.sec-sep`: 1px gradient separator between every major section
- `.price-badge`: `background: linear-gradient(135deg,#7c3aed,#4f46e5)` + `badgePulse` animation + glow
- `.price-card.pop`: `border: 1.5px solid rgba(124,58,237,0.5); margin-top:-12px; transform:scale(1.03)`
- `.pl-timeline`: 3-column CSS grid (`var(--pl-ghost-w) 64px 1fr`) for pipeline section
- `.cycling-keyword`: `color: #f472b6; transition: opacity 0.3s, transform 0.3s`
- `.cal-container`, `.cal-left/.center/.right`, `.cal-day`, `.cal-slot`, `.cal-confirm-btn`

**LandingPage.jsx** — full rewrite:
- `KEYWORDS = ['ROAS drops','CTR collapses','spend spikes','budgets bleed']` cycling hero subtitle
- `cycleIdx` + `kwVisible` state with 2.2s interval + 300ms fade transition
- Shooting star pool: 16-star POOL, offscreen canvas for 20 deterministic static slashes (Math.sin seed), animated via requestAnimationFrame
- Vertical pipeline timeline using `React.Fragment` + 3-column CSS Grid: ghost label / node / panel
- Scroll-driven `--fill-height` for vertical line fill in pipeline
- Book a Call section: mock calendar (month nav, date select, time slot, confirm button)
- `<div className="sec-sep" />` between every major section

### N2 — Micro-fixes (2026-03-06)
- **Em dashes removed** from all body copy (replaced with commas or periods)
  - AGENTS desc, pillars sec-sub, Budget Guardian, Creative Agent, SEO Intelligence
  - Preview URL: `adpilot.app — Command Center` → `adpilot.app · Command Center`
- **Cycling keyword** hero subtitle implemented (was static)
- **Most Popular badge** redesigned with gradient + glow pulse
- **Per-section backgrounds** applied (was uniform dark)
- **Shooting star pool** system replaces simple single-star animation

### Git History
- Commit `f5ac31b1`: feat(ui): premium landing page visual polish
- Commit `a9dfcea6`: chore: gitignore .claude/settings.local.json (removed exposed API key)
- Commit `c21ee3be`: feat(ui): micro-fixes — cycling keyword, per-section backgrounds, shooting star pool, badge pulse, remove em dashes

---

## Phase P — Free Feature Implementation + Architecture Hardening ✅ Complete (2026-03-06)

### P1 — Ad Generation Fix
- `generateAdSchema` updated: now accepts `keyword`, `platform`, `goal` fields (was strict, rejected them)
- `adService.generateAdWithAI()`: provider order reordered to Anthropic first (most reliable), added `withTimeout` per provider (8-12s), `tryProvider()` helper swallows timeout errors gracefully
- `AnthropicService.generateAds()`: now includes `keyword` in prompt when provided
- New `src/orchestrators/adsOrchestrator.js`: cache-first (30min TTL), 30s overall timeout, returns `_cached: true/false`
- `adController.generate()`: uses orchestrator, returns `meta.cached` in response

**Result:** `POST /api/v1/campaigns/:id/ads/generate` accepts `{keyword, platform, goal, targetAudience}`, returns 3 real AI variations in ~5s (1ms on cache hit)

### P2 — Keyword Research (new endpoint)
- `src/services/seo/KeywordResearchService.js` — 4 free sources in parallel:
  1. Google Autocomplete (`suggestqueries.google.com`) — no key
  2. DuckDuckGo Suggest (`duckduckgo.com/ac/`) — no key
  3. Google Trends (`google-trends-api` npm package) — no key
  4. Anthropic/Gemini AI for difficulty + intent labels
- `GET /api/v1/seo/keywords/research?q=...` added to seoRoutes.js
- `seoController.researchKeyword()` with 2-hour cache
- Returns: `{ keyword, suggestions[], trends{averageInterest,peakInterest,trend,dataPoints[]}, insights{difficulty,intent,estimatedCpc,targetedAngles,negativeKeywords,summary}, sources{} }`

### P3 — Competitor Analyze (new endpoint)
- `POST /api/v1/competitors/analyze` added to competitorRoutes.js
- `researchController.analyzeUrl()` — strips domain, calls CompetitorHijackService (real Puppeteer crawl + AI)
- Existing `/api/v1/research/hijack-analysis?domain=` still works

### P4 — Pulse Monitoring (new feature)
- `src/services/pulse/PulseService.js`:
  - Reads `campaign.performance` JSON + `campaignAlerts` rules from DB
  - `scan(teamId)`: evaluates roas_drop, ctr_collapse, cpa_spike, spend_anomaly thresholds
  - Creates `Notification` records (type=ALERT) with 1hr cooldown per rule
  - `startCron()`: node-cron every 15 min, scans all teams
  - `demoMode=true` when no META_ACCESS_TOKEN/GOOGLE_ADS_DEVELOPER_TOKEN
- `src/routes/pulseRoutes.js` — mounted at `/api/v1/pulse`
- `src/controllers/pulseController.js`:
  - `GET /pulse/alerts` — last 20 ALERT notifications, strips `[rule:xxx]` internal tags
  - `POST /pulse/check` — on-demand scan for current team
  - `GET /pulse/status` — demoMode flag + connected integrations
- `server.js` — `pulseService.startCron()` called at startup (non-fatal)

### P5 — Integration Status (new endpoint)
- `GET /api/v1/integrations/status` added to integrationRoutes.js
- Returns: `{ ai{anthropic,gemini,openai,groq,huggingface,ollama}, adPlatforms{meta,google,ga4}, seo{valueserp}, missing[] }`

### P6 — Architecture Hardening
- `src/utils/timeout.js` — `withTimeout(promise, ms)` — race against timeout
- `src/utils/retry.js` — `withRetry(fn, {retries, backoff})` — exponential backoff
- `src/cache/index.js` — node-cache layer: `get/set/del/getOrSet/delByPrefix/stats`
  - TTLs: AI 30min, keywords 2hr, competitor 1hr, dashboard 5min, pulse 30s
- `src/middleware/timing.js` — injects `meta.responseTime` + `X-Response-Time` header into every JSON response, warns on >1s requests

### Packages Added
- `google-trends-api` — Google Trends data (no key)
- `node-cron` — cron scheduler for pulse monitoring
- `groq-sdk` — Groq AI (fast free tier, not yet wired in)
- `node-cache` — in-memory cache backing layer

### Feature Status (tested)
```
FEATURE                  | STATUS   | SOURCE                  | RT (fresh/cache)
-------------------------|----------|-------------------------|------------------
Ad Generation            | WORKING  | Anthropic claude-haiku  | ~5s / 1ms
Keyword Research         | WORKING  | Google+DDG+Trends+AI    | ~3.5s / instant
Competitor Analysis      | WORKING  | Puppeteer+AI            | ~26s (site dep.)
Gaps Monitor             | WORKING  | Keyword diff            | 7ms (empty w/o competitors)
Pulse Alerts             | WORKING  | node-cron+Prisma        | 11ms
Pulse Check              | WORKING  | On-demand scan          | 12ms, scanned 4 campaigns
Integration Status       | WORKING  | .env key detection      | instant
Response Timing          | WORKING  | timing middleware        | all responses

CONNECTED AI: anthropic, gemini, huggingface, ollama
MISSING AD PLATFORMS: META_ACCESS_TOKEN, GOOGLE_ADS_DEVELOPER_TOKEN, GA4_MEASUREMENT_ID
```

### New File Index
```
src/utils/timeout.js                    — withTimeout helper
src/utils/retry.js                      — withRetry helper
src/cache/index.js                      — node-cache layer
src/middleware/timing.js                — responseTime injection
src/orchestrators/adsOrchestrator.js    — cache-first ad generation
src/services/seo/KeywordResearchService.js — Google+DDG+Trends+AI keyword research
src/services/pulse/PulseService.js      — 15-min cron monitor + threshold eval
src/routes/pulseRoutes.js               — /pulse/alerts, /pulse/check, /pulse/status
src/controllers/pulseController.js      — pulse endpoint handlers
```

### Commit
- `9bce9ffb`: feat: full feature implementation + architecture hardening

---

## Phase Q2 — Premium Experience Sprint ✅ Complete (2026-03-07)

### Dashboard Command Center (DashboardPage.jsx — complete rewrite)
- 3 parallel queries: `/dashboard/metrics` + `/dashboard/health-score` + `/dashboard/recommendations`
- `HealthRing` SVG component with animated count-up, color-coded (green/amber/red), AI verdict from Anthropic/Gemini
- KPI cards: Ads Created | Keywords | Competitors | Unresolved Alerts — with sparklines (7-pt), deltas, click-to-navigate
- AI Recommendations section: uses `/recommendations` endpoint (rule-based + optional AI enhancement), priority badges (CRITICAL/HIGH/MED/LOW), action buttons that navigate
- Activity Timeline: from metrics activityFeed, with "View all" link
- Keyword Trends: rising keywords shown inline
- Quick Actions grid: 3 gradient cards (SEO Audit / Generate Ads / Scan Budget Health)
- Generate Report button in header

### Report Modal (inline in DashboardPage)
- Calls `/reports/generate?range=7d|30d|90d`
- Range selector UI (pill buttons)
- Loading state: "Compiling your report…" with spinner
- Report card: HealthRing + health label, 6-metric grid (spend/revenue/ROAS/CTR/conversions/campaigns), SEO + Intelligence summary, AI executive summary with highlight/warning cards
- Copy as Text: structured plain-text report for Slack/email
- Download PDF: uses `window.print()`

### Bulk Audit Modal (SeoPage.jsx)
- "Bulk Audit" button next to single-URL form
- `BulkAuditModal`: textarea for up to 10 URLs, per-URL live status (pending → running → done/error icons)
- Sequential submission with 1.2s gap
- Auto-opens result panel for last successful audit

### CSV Export Utility
- `client/src/lib/exportCsv.js` — `exportToCSV(data, columns, filename, headers?)` with proper CSV escaping
- Campaigns table: name, platform, status, budget, type, date
- SEO audits list: url, score, grade, status, date
- SEO keywords list: keyword, rank, previous rank, url, active
- Budget alert rules: campaign, type, threshold, action, active, triggered
- Competitors list: domain, name, added date
- Notifications: message, type, read, date

### Other Polish
- `BudgetProtectionPage`: sentinel-pulse animation on critical status banner (`sentinel-pulse` CSS class)
- All CSV export buttons use subtle `btn-secondary` style in section headers

### Server Note
- Backend runs `node src/server.js` (not nodemon) — must restart to pick up new endpoints
- New endpoints `/dashboard/health-score`, `/dashboard/recommendations`, `/reports/generate` exist in code (from prior commit `095270af`) but require server restart to activate
- Frontend gracefully falls back to `/dashboard/metrics` data if health-score/recommendations return error

### Commit
- `10e73dfc`: feat: premium experience sprint — health score, AI recommendations, one-click reports, bulk audit, CSV exports

*Last updated: 2026-03-07 — Session: Phase Q2 Premium Experience Sprint*

---

## Screenshot Audit Fix Sprint ✅ Complete (2026-03-07)

### Bug Fixes (7 files changed)

#### API Response Shape Fixes
- `getKeywords` was returning `paginated({items:[]})` but frontend expected array → changed to `success({keywords:[], total})`
- `getAudits` same issue → `success({audits:[], total})`
- `getBriefs` same issue → `success({briefs:[], total})`
- Frontend `SeoPage.jsx` + `ResearchPage.jsx` updated to use `.keywords ?? .items ?? []` fallback pattern

#### Keywords Tab — All Zeros
- `syncRanks()` now fetches Google Trends interest score as searchVolume proxy for keywords with volume=0
- Estimates difficulty from trend score (high→75, medium→45, low→25)
- `opportunityScore` fixed NaN when searchVolume=0 or difficulty=0 (guard + default diff=30)
- Frontend shows `'—'` for null rank, zero volume, and no rank-change history

#### Sync Ranks Button — No Visible Effect
- Was queuing a Bull job async (user never saw result); now runs `syncRanks()` synchronously
- Returns `{synced: N, updates: [...], message: "Synced N keyword(s)"}` immediately

#### Keyword Research — No Results
- Service returns nested `{trends:{averageInterest, trend, dataPoints}, insights:{difficulty, summary}}`
- Controller now normalizes to flat shape: `{trendScore, trend, trendHistory:[{label,score}], difficulty, aiInsight, bestPlatform, suggestions}`
- Google Trends single-word query retry: appends " online" if first attempt returns empty
- Frontend `KeywordResearchSection` now renders trend sparkline, AI insight, suggestions

#### Market Research — Only Shows Domain
- Was reading `data.landingPageData` (never exists in API response)
- Fixed to read `data.title`, `data.description`, `data.headings`, `data.ctas`, `data.topKeywords`, `data.techStack`, `data.messagingAngles`, `data.weaknesses`, `data.keywordGaps` directly
- Now renders: site overview, content strategy headlines, CTAs, keyword cloud, messaging angles, weaknesses, keyword gaps

#### Gaps Tab — Always Empty
- `Competitor.topKeywords` was always `[]` because analysis results were never saved back
- `hijackAnalysis` + `analyzeUrl` now call `_saveCompetitorKeywords()` after each analysis
- Saves `topKeywords` as `[{keyword, rank:10}]` to the tracked Competitor record

#### Content Briefs — Generic Headings
- Fallback `_generateTitle` now deterministic (hash-based, not random) with specific year titles
- `_generateOutline` replaces "What is X?" / "Why X Matters" with actionable year-specific headings
- `_generateWithAnthropic` passes `instructions` param to avoid generic headings

#### SEO Audit — 24hr Dedup
- `triggerAudit` checks for completed audit for same team+URL within 24 hours
- Returns `{auditId, cached:true, cachedAt, message}` instead of re-queuing
- Override with `?force=1` query param

### Commit
- `e388adcf`: fix: screenshot audit — keywords data, research, market analysis, gaps, briefs

---

## Port Conflict + Railway Build Fix ✅ Complete (2026-03-08)

### Root Cause: Port 3000 IPv4/IPv6 Split
- AdPilot backend (PID from `npm run dev`) binds to IPv4 `0.0.0.0:3000`
- linkedpilot Next.js app (separate project) was also running, binding IPv6 `:::3000`
- macOS allows two processes to bind the same port on different IP stacks
- Browser resolves `localhost` → `::1` (IPv6 first), so Vite proxy → linkedpilot, not AdPilot
- Fix: `kill <linkedpilot-pid>` — always kill other Next.js servers before starting AdPilot
- Vite frontend was not running either — started on port 5173

### Port Reference
| Service | Port | Command |
|---------|------|---------|
| Backend | 3000 (IPv4) | `npm run dev` (from /Adpilot root) |
| Frontend | 5173 | `cd client && npm run dev` |
| Postgres | 5432 | Docker |
| Redis | 6379 | Docker |
| Railway | Railway-injected PORT (~8080) | single server serves API + static React |

**Kill port conflicts:** `lsof -i tcp:3000 -sTCP:LISTEN` — kill any non-AdPilot PIDs

### Railway Dockerfile Fix
- `prisma` CLI was in devDependencies → `npm ci --omit=dev` skipped it
- `npx prisma generate` and `npx prisma db push` in Docker had to download prisma from npm at build/runtime (flaky)
- Fix: moved `prisma` to production `dependencies` in package.json
- Dockerfile now uses `node_modules/.bin/prisma` (guaranteed available)
- Commit: `70c966d9`

### Railway Env Vars Required (set in Railway dashboard)
| Variable | Source |
|----------|--------|
| DATABASE_URL | Railway PostgreSQL service (auto-linked) |
| REDIS_URL | Railway Redis service (auto-linked) |
| JWT_SECRET | `openssl rand -hex 32` (≥32 chars) |
| JWT_REFRESH_SECRET | `openssl rand -hex 32` (≥32 chars) |
| ENCRYPTION_KEY | `openssl rand -hex 32` (64 hex chars) |
| NODE_ENV | `production` |

After first Railway deploy: run seed via Railway CLI or console:
`railway run node src/scripts/seed.js`
