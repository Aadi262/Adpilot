# AdPilot — Master Project Plan

> **Rule:** Update this file at the end of every session when something meaningful changes.
> **Rule:** Never create multiple plan files. This is the single source of truth.
> **Start every session with:** `Claude, continue with PLAN.md`

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

**New files:**
- `src/services/notificationHelper.js` — `createNotification()` shared helper
- `src/controllers/notificationController.js` — full REST (5 endpoints)
- `src/controllers/userController.js` — GET/PATCH /users/me, change-password
- `src/routes/notificationRoutes.js` — GET, PATCH /read-all, PATCH /:id/read, DELETE /:id, POST /test
- `src/routes/userRoutes.js` — GET /, PATCH /, POST /change-password
- `client/src/components/ErrorBoundary.jsx` — React class error boundary
- `client/src/pages/NotificationsPage.jsx` — full notifications list with filter tabs
- `client/src/pages/SettingsPage.jsx` — Profile / Security / Notifications / Danger Zone tabs
- `client/src/pages/ResearchPage.jsx` — Competitors / Market Research / Ad Intelligence
- `client/src/pages/AdStudioPage.jsx` — All Ads / Generate / A/B Tests tabs

**Updated files:**
- `client/src/App.jsx` — lazy-load all pages, ErrorBoundary per route, new routes (settings/notifications/ads/research)
- `client/src/components/layout/TopBar.jsx` — "View all notifications →" link
- `client/src/lib/api.js` — 500 interceptor → custom event → toast
- `client/src/main.jsx` — ToastProvider wraps app
- `client/src/pages/DashboardPage.jsx` — hero empty state
- `client/src/pages/AnalyticsPage.jsx` — date range filter + CSV export
- `src/queues/processors/seoAuditProcessor.js` — createNotification on complete/fail
- `src/controllers/campaignController.js` — createNotification on launch/pause

---

### Phase D — Next: Real API Integrations & Billing

| Task | Description |
|------|-------------|
| D1 | Meta Ads API — real campaign sync |
| D2 | Google Ads API — real campaign sync |
| D3 | Stripe billing — subscription plans (Starter/Pro/Business) |
| D4 | Email queue — Resend integration for weekly digest |
| D5 | Production deployment — Railway/Render + Vercel |

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
Overall:  ████████████████████████░░░░░  80%

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
Stage 8 (Billing):     ░░░░░░░░░░    0%
Stage 9 (Deploy):      ░░░░░░░░░░    0%
```

---

## 6. Next Actions

1. **Enable & test summary** — set `ANTHROPIC_API_KEY` + `SEO_SUMMARY_ENABLED=true` in `.env`, run end-to-end on a real URL.
2. **Manual browser test** — run audit on `https://example.com`, verify full result panel (score gauge, categories, issues, performance metrics, executive summary).
3. **Keyword sparkline** — add Recharts `<LineChart>` sparkline to the keywords table using `GET /keywords/:id/history` data (show on row expand or in a detail drawer).
4. **Production hardening** — per-team concurrency limits (max 2 concurrent audits), daily audit rate limits, `/health` endpoint with Redis + DB liveness checks.
5. **Stage 8 — Billing** — Stripe integration, plan upgrade/downgrade flow, usage metering.

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

---

## 9. Key File Index

```
── Routing & Controllers ────────────────────────────────────────────────────────
  src/routes/seoRoutes.js                     — all /seo/* routes (audit + keyword + gap + brief)
  src/controllers/seoController.js            — audit CRUD, keyword CRUD, discover, history,
                                                gaps, briefs; v1/v2 mapper + _parseSummary

── SEO Audit Pipeline ───────────────────────────────────────────────────────────
  src/queues/processors/seoAuditProcessor.js  — Bull job router (v2 / legacy)
  src/services/seo/audit/AuditOrchestrator.js — pipeline conductor + ACTIVE_STATUSES export
  src/services/seo/audit/adapters/PuppeteerAdapter.js — Puppeteer page data extraction
  src/services/seo/audit/engines/CrawlEngine.js       — BFS crawler, robots.txt path filter
  src/services/seo/audit/engines/TechnicalAnalyzer.js — runs all rules, sorts by severity
  src/services/seo/audit/engines/PerformanceEngine.js — Lighthouse (serial, fallback)
  src/services/seo/audit/engines/ScoringEngine.js     — weighted scoring, bonuses, letter grade
  src/services/seo/audit/rules/registry.js            — 23 stateless rule instances
  src/services/seo/audit/rules/technical/             — 12 technical rules
  src/services/seo/audit/rules/content/               — 7 content rules (incl. ImageDimensions, LazyLoading)
  src/services/seo/audit/rules/structure/             — 4 structure rules
  src/services/seo/SeoSummaryService.js               — LLM summary via Anthropic Claude API

── Keyword Tracking ─────────────────────────────────────────────────────────────
  src/services/seo/KeywordTrackingService.js          — getKeywords (enriched), syncRanks (+history),
                                                        getOpportunities (Redis-cached)
  src/services/keywords/KeywordService.js             — createKeyword, deleteKeyword
  src/services/keywords/KeywordDiscoveryService.js    — strategy wrapper for discovery
  src/services/keywords/discovery/AuditDiscoveryStrategy.js — extract title/H1/meta from audit,
                                                              stopword filter, bigram boost, top 15

── Other SEO Services ───────────────────────────────────────────────────────────
  src/services/seo/CompetitorGapService.js    — gap analysis (competitor ≤20, us >50)
  src/services/seo/ContentBriefService.js     — TF-IDF clustering, outline generation

── Config ───────────────────────────────────────────────────────────────────────
  src/config/seo.js                           — crawl/lighthouse/scoring constants
  src/config/limits.js                        — per-plan limits (maxPages, summaryEnabled, etc.)
  src/config/featureFlags.js                  — SEO_ENGINE_V2, LIGHTHOUSE_ENABLED, SEO_SUMMARY_ENABLED

── Database ─────────────────────────────────────────────────────────────────────
  prisma/schema.prisma                        — all 14 models incl. KeywordRank (Phase 3)
  prisma/migrations/20260228100000_*/         — SEO audit v2 columns
  prisma/migrations/20260301155759_*/         — keyword_ranks table + Keyword additions

── Queues ───────────────────────────────────────────────────────────────────────
  src/queues/index.js                         — 7 named Bull queues
  src/queues/processors/seoAuditProcessor.js  — see above
  src/queues/processors/keywordSyncProcessor.js — calls KeywordTrackingService.syncRanks

── Frontend ─────────────────────────────────────────────────────────────────────
  client/src/pages/SeoPage.jsx                — full SEO page: AuditsTab (run/list/delete),
                                                KeywordsTab (add/delete/discover), GapsTab,
                                                ContentBriefs, AuditResultPanel,
                                                ExecutiveSummaryPanel, AddKeywordModal,
                                                ConfirmDialog
  client/src/lib/api.js                       — Axios instance, auth interceptor, pagination normalizer
  client/src/App.jsx                          — routes (/seo → SeoPage)


---

*Last updated: 2026-03-01 — Session: Phase 3 complete (KeywordRank model, keyword CRUD, discovery from audit, KeywordsTab rewrite)*
