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
| **7** | **LLM Executive Summary (SeoSummaryService)** | **✅ Complete** |
| 8 | Payments / billing integration | ⏳ Pending |
| 9 | Production deployment | ⏳ Pending |

---

## 3. Current Stage — Enhancement Phases (Master Prompt)

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

### Phase 3 — Pending

Phase 3 (keyword discovery, rank tracking schema, KeywordRank model) not yet started.

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
Overall:  █████████████████████░░░░░░░░  70%

Stage 1 (Backend):     ██████████  100%
Stage 2 (Frontend):    ██████████  100%
Stage 3 (Hardening):   ██████████  100%
Stage 4 (SEO Engine):  ██████████  100%
Stage 5 (SEO UI):      ██████████  100%
Stage 6 (Validation):  ██████████  100%
Stage 7 (Summary):     ██████████  100%
Phase 2 (Rules++):     ██████████  100%  ✅
Phase 3 (Keywords):    ░░░░░░░░░░    0%  ← next
Stage 8 (Billing):     ░░░░░░░░░░    0%
Stage 9 (Deploy):      ░░░░░░░░░░    0%
```

---

## 6. Next Actions

1. **Enable summary** — set `ANTHROPIC_API_KEY` + `SEO_SUMMARY_ENABLED=true` in `.env`, test end-to-end.
2. **Manual browser test** — run audit on `https://example.com`, verify result panel (score gauge, categories, issues, metrics, summary).
3. **Phase 3** — keyword discovery from URL, `KeywordRank` Prisma model + migration, rank history API routes, Keywords tab wired to real data.
4. **Phase 5** — per-team concurrency limits, daily audit rate limits, health endpoint.

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
Backend
  src/routes/seoRoutes.js                    — POST /audit, GET /audit/:id, GET /audits
  src/controllers/seoController.js           — triggerAudit, getAudit (v1/v2 mapper + _parseSummary)
  src/queues/processors/seoAuditProcessor.js — Bull job router (v2 / legacy)
  src/services/seo/audit/AuditOrchestrator.js — full pipeline + ACTIVE_STATUSES
  src/services/seo/audit/engines/CrawlEngine.js
  src/services/seo/audit/adapters/PuppeteerAdapter.js
  src/services/seo/audit/engines/TechnicalAnalyzer.js
  src/services/seo/audit/rules/registry.js   — 23 stateless rule instances (Phase 2)
  src/services/seo/audit/engines/PerformanceEngine.js — Lighthouse singleton
  src/services/seo/audit/engines/ScoringEngine.js
  src/services/seo/SeoSummaryService.js      — LLM summary via Anthropic Claude API
  src/config/seo.js                          — crawl/lighthouse/scoring config
  src/config/limits.js                       — per-plan limits (summaryEnabled: pro/business only)
  src/config/featureFlags.js                 — SEO_ENGINE_V2, LIGHTHOUSE_ENABLED, SEO_SUMMARY_ENABLED
  prisma/schema.prisma                       — SeoAudit model with v1+v2 columns (summary: String?)
  prisma/migrations/20260228100000_*/        — v2 column migration SQL

Frontend
  client/src/pages/SeoPage.jsx               — full SEO page + AuditResultPanel + ExecutiveSummaryPanel
  client/src/lib/api.js                      — Axios instance + pagination normalizer
  client/src/App.jsx                         — Routes (/seo → SeoPage, already wired)
```

---

*Last updated: 2026-03-01 — Session: Phase 2 complete (7 new rules, scoring bonuses, robots.txt path filtering, export PDF + re-run buttons)*
