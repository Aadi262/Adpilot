# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Unimplemented AI Features (Budget Protection & Scaling Predictor):**
- Issue: `src/services/ai/BudgetProtectionService.js` line 27 contains TODO for Phase D1 real implementation. Currently uses mock seeded scores (charCodeAt on campaign ID). Scaling Predictor similarly deterministic (`src/services/ai/ScalingPredictorService.js` line 25).
- Files: `src/services/ai/BudgetProtectionService.js`, `src/services/ai/ScalingPredictorService.js`
- Impact: Features appear functional but return mocked data, not real insights. Missing integrations with Meta/Google Ads APIs for actual campaign metrics. Will break when users expect real analysis.
- Fix approach: Implement `fetchCampaignMetrics()`, `evaluateThresholds()`, `executeAction()` methods. Add meta-business-sdk and google-ads-api packages. Wire real API calls in processors.

**Generic Error Handling in Services:**
- Issue: Multiple services throw `new Error()` instead of `AppError.*()`. Lines in `src/services/ai/BudgetProtectionService.js` (141, 166, 179), `src/services/ai/ScalingPredictorService.js` (133).
- Files: `src/services/ai/BudgetProtectionService.js` (lines 141, 166, 179), `src/services/ai/ScalingPredictorService.js` (line 133)
- Impact: Errors don't use the centralized error handling pattern. May leak implementation details. Won't get normalized by errorHandler middleware properly.
- Fix approach: Replace all `throw new Error(...)` with `throw AppError.notFound(...)` or `AppError.badRequest(...)` as appropriate.

**Prisma Connection Pool Configuration Missing:**
- Issue: `src/config/prisma.js` does not set connection pool limits. Default pool size may not scale for production load.
- Files: `src/config/prisma.js`
- Impact: High concurrent load could exhaust connections. No backpressure mechanism. Database connection exhaustion = cascading 503s.
- Fix approach: Add `connectionLimit`, `idleTimeout`, and `maxQueryDuration` via PrismaClient constructor options. Set pool size based on replica count.

**No Database Query Optimization Warnings:**
- Issue: Controllers and services use sequential `findMany()` calls that could be parallelized. E.g., `src/controllers/dashboardController.js` lines 78-91 fetches notifications and activity separately.
- Files: `src/controllers/dashboardController.js`, `src/services/seo/KeywordTrackingService.js`
- Impact: Dashboard loads slower than necessary. Multiple round-trips to DB add cumulative latency.
- Fix approach: Consolidate related queries with `Promise.all()`. Add indexes on common filter patterns.

## Known Bugs

**Zod Validation Error Handling (FIXED - v1.0):**
- Issue: `src/middleware/validateZod.js` line 21 previously accessed `result.error.errors` but Zod uses `result.error.issues`. This was causing 500s on all strict-schema validation.
- Files: `src/middleware/validateZod.js`
- Workaround: Recently fixed in Phase M. Verify in production that strict schema endpoints now return proper 400 validation errors.

**Resource Cleanup Race in Puppeteer Adapter:**
- Issue: `src/services/seo/audit/adapters/PuppeteerAdapter.js` has `_intentionalClose` flag to suppress disconnect warnings, but if a page times out during navigation and the browser is closed concurrently, page cleanup may fail silently.
- Files: `src/services/seo/audit/adapters/PuppeteerAdapter.js` (lines 42-43)
- Trigger: Very large crawl (>500 pages) where one slow page times out while others are still fetching.
- Workaround: Browser close in finally block will still execute; page resource leak is bounded to that audit run only (browser is new per audit).

## Security Considerations

**API Key Exposure in Error Messages:**
- Risk: `src/middleware/errorHandler.js` line 10 checks error messages for secret patterns (GEMINI_API_KEY, VALUESERP_API_KEY, etc.) but this is reactive. If a service leaks a key in the response body before errorHandler sees it, the key is already in the response stream.
- Files: `src/middleware/errorHandler.js` (line 10)
- Current mitigation: Helmet headers, XSS sanitization middleware, error normalization. Services are instructed to not embed keys in messages.
- Recommendations: Add a pre-response filter that strips env var patterns from all response bodies. Log detected patterns without including the value.

**Token Encryption Key Hardcoded in Development:**
- Risk: `.env.example` shows `ENCRYPTION_KEY=0000...` (64 zeros) for local development. If this gets committed in a real `.env` file, all token encryption is broken.
- Files: `.env.example`, `src/services/integrations/TokenEncryptionService.js`
- Current mitigation: `.env` is in `.gitignore`. Pre-commit hook should catch if someone tries to commit `.env`.
- Recommendations: Add a startup check in `src/config/env.js` that warns if ENCRYPTION_KEY is all zeros or test default.

**No Rate Limiting on File Upload Endpoints:**
- Risk: No file upload endpoints exist yet, but `src/middleware/rateLimiter.js` has no specific config for multipart/form-data. If file uploads are added without rate limits, attackers can DoS with large files.
- Files: `src/middleware/rateLimiter.js`
- Current mitigation: express-rate-limit is installed but not configured for uploads.
- Recommendations: Add file size limit to Express body parser (100MB max). Create uploadLimiter with 5 files/min per team. Document before adding upload feature.

**JWT Token in Request Logs:**
- Risk: If debugging enables request body logging, JWT tokens could be captured in logs. Currently guarded (line 62 in errorHandler), but not in all code paths.
- Files: `src/middleware/errorHandler.js` (line 62)
- Current mitigation: Production environment skips body logging. Development logs body but only on errors.
- Recommendations: Add a sanitize function to redact Authorization headers from all logs. Use `before` hook in logger to strip bearer tokens.

## Performance Bottlenecks

**SEO Audit Wall-Clock Timeout (10 min):**
- Problem: `src/services/seo/audit/AuditOrchestrator.js` line 46 sets TOTAL_TIMEOUT_MS to 10 minutes. Large sites (1000+ pages) may exceed this under slow network or high Chrome memory pressure.
- Files: `src/services/seo/audit/AuditOrchestrator.js` (line 46)
- Cause: Puppeteer + Lighthouse on large crawls is inherently slow. No progressive timeout tuning (doesn't scale based on site size).
- Improvement path: Make timeout configurable per plan tier. Detect site size upfront (robots.txt estimate) and auto-adjust timeout. Add checkpoint progress saves so interrupted audits can resume.

**Lighthouse ESM Import on Every Audit:**
- Problem: `src/services/seo/audit/engines/PerformanceEngine.js` lines 29-40 cache the Lighthouse import, but fallback to dynamic import every time if first attempt fails.
- Files: `src/services/seo/audit/engines/PerformanceEngine.js` (lines 29-40)
- Cause: CJS/ESM bridge is slow. The cache helps, but if lighthouse is unavailable, every audit re-attempts the import.
- Improvement path: Pre-load lighthouse during server startup. If not available, fail fast with a clear feature-flag error instead of trying on every audit.

**Concurrent Browser Instances Not Limited:**
- Problem: `src/services/seo/audit/AuditOrchestrator.js` and `src/services/seo/audit/engines/PerformanceEngine.js` each launch their own browser. Multiple concurrent audits = multiple Chrome processes.
- Files: `src/services/seo/audit/AuditOrchestrator.js`, `src/services/seo/audit/engines/PerformanceEngine.js`
- Cause: No queue rate limiting. Bull processes seoAudit with concurrency=1, but PerformanceEngine's separate browser still runs in parallel.
- Improvement path: Add a browser pool that limits total Chrome instances to 3-4 max. Share the pool between crawl and performance engines. Backpressure on job queue when pool is full.

**N+1 Query Pattern in Dashboard Aggregator:**
- Problem: `src/controllers/dashboardController.js` getKeywordStats (line 38) and getCompetitorStats (line 60) fetch all records then filter in memory. If a team has 1000 keywords, all are fetched even if dashboard only shows top 10.
- Files: `src/controllers/dashboardController.js` (lines 38-66)
- Cause: `take: 30` limits the fetch, but no filter for `trend === 'rising'` in the query. All keywords fetched, then filtered.
- Improvement path: Move trend calculation into the database query. Add indexes on (teamId, isActive, trend). Use `findMany()` with trend pre-filter.

**Analytics Aggregator Cache Miss Recalculation:**
- Problem: `src/services/analytics/AnalyticsAggregator.js` recalculates all campaign metrics on cache miss. For large teams (100+ campaigns), this can take 5+ seconds.
- Files: `src/services/analytics/AnalyticsAggregator.js`
- Cause: No distributed cache (Redis). Falls back to synchronous calculation. No cache warming job.
- Improvement path: Add hourly job to pre-warm analytics cache. Use Redis hash for campaign scores. Add a background "metrics refresh" job that updates cache every 30 min instead of waiting for cache miss.

## Fragile Areas

**SEO Audit v2 Orchestrator Complex State Machine:**
- Files: `src/services/seo/audit/AuditOrchestrator.js` (435 lines)
- Why fragile: Multiple stages (crawl → analyze → score → summarize), each with independent error handling. Mutable context object (`ctx`) passed through stages. If one stage fails mid-operation, resume is not supported. Timeout handler must find and update the audit record.
- Safe modification: Add explicit state checkpoints. Save intermediate results (crawl data) to DB immediately after crawl completes. This way a failed audit can be resumed or inspected.
- Test coverage: Integration tests exist but no test for timeout scenario. Add test that kills browser mid-crawl and verifies graceful failure.

**Puppeteer Browser Resource Lifecycle:**
- Files: `src/services/seo/audit/adapters/PuppeteerAdapter.js` (358 lines)
- Why fragile: Browser is created lazily on first `fetchPage()`. If two audits try to fetch simultaneously, both might call `_getBrowser()` before the first one assigns to `this._browser`. Second browser instance created but never closed.
- Safe modification: Add a promise lock via `pLimit` package. Only one browser initialization at a time.
- Test coverage: Add concurrency test that launches two audits simultaneously and verifies only one browser is created.

**Integration Token Encryption with Hardcoded Key:**
- Files: `src/services/integrations/TokenEncryptionService.js`
- Why fragile: Relies on ENCRYPTION_KEY env var being exactly 64 hex characters. If key is rotated, all old tokens become unreadable. No migration path.
- Safe modification: Add key versioning. Store a key_id with each encrypted token. Support multiple keys during rotation period.
- Test coverage: Test what happens when ENCRYPTION_KEY changes (should fail gracefully).

**Rule Engine 60-Minute Cooldown (Not Enforced in DB):**
- Files: `src/services/rules/RuleEngine.js`
- Why fragile: Cooldown is applied in-memory only. If the service restarts, the cooldown map is lost. A rule could trigger multiple times within the 60-minute window across restarts.
- Safe modification: Store last_triggered_at in database (add to Rule model). Check DB cooldown before evaluating rule.
- Test coverage: Simulate service restart mid-cooldown and verify rule is still cooldown-protected.

**Email Service Hardcoded Provider:**
- Files: `src/services/email/EmailService.js`
- Why fragile: Uses Resend hardcoded. If Resend API goes down, all email features fail silently (no fallback).
- Safe modification: Abstract into an adapter pattern. Add SMTP fallback. Make provider configurable.
- Test coverage: Add test for email failure (Resend down) and verify fallback.

## Scaling Limits

**Puppeteer Memory Usage on Large Crawls:**
- Current capacity: Can reliably crawl ~500 pages per audit in a 2GB container.
- Limit: Beyond 500 pages, Chrome process memory grows non-linearly. At ~1000 pages, OOM kills are likely.
- Scaling path: (1) Add page count limits per plan tier (starter: 50, pro: 500, enterprise: 2000). (2) Implement chunked crawling (crawl 100 pages, flush to DB, restart browser). (3) Use browser pool with memory monitoring.

**Concurrent SEO Audits (Bull Queue):**
- Current capacity: Queue processes 1 audit at a time. 10 teams with concurrent audits = 10-hour queue backlog.
- Limit: Each audit takes 2-10 min depending on size. More than 5-6 concurrent users = visible delays.
- Scaling path: Increase Bull concurrency to 3, but add health check to prevent OOM. Add priority queue (enterprise audits first). Use separate queue cluster for audits on separate worker process.

**Database Connection Pool:**
- Current capacity: Default Prisma pool ~10 connections. Peak load with multiple controllers + queue processors could hit pool limit.
- Limit: ~50-100 concurrent requests saturate pool. Subsequent requests queue and timeout.
- Scaling path: Increase connection limit to 20 (requires more RAM on Postgres). Add read replicas for analytics queries. Use connection pooling middleware (pgBouncer).

**Redis Memory for Caching & Bull Queues:**
- Current capacity: Single Redis instance, default 256MB limit.
- Limit: With analytics cache + 6 named queues + job retention, memory grows to ~100MB in production.
- Scaling path: Set Redis memory limit to 512MB. Implement cache eviction policy (allkeys-lru). Monitor Bull queue job retention and prune old failed jobs weekly.

**Puppeteer Lighthouse Separate Browser:**
- Current capacity: 2 browsers (crawl + lighthouse) running per audit. Tight on container with <4GB RAM.
- Limit: Can't run more than 1-2 audits concurrently without OOM.
- Scaling path: Share browser pool. Implement pooled CDP connections. Move Lighthouse to separate microservice (node:lighthouse-service).

## Dependencies at Risk

**Puppeteer Version Mismatch:**
- Risk: `package.json` pins puppeteer@^24.37.5. Chrome binary versioning is strict. If DevOps updates Chrome without updating Puppeteer, audits fail with protocol version errors.
- Impact: SEO audits blocked entirely. No workaround.
- Migration plan: Use puppeteer with browserless.io (hosted service) instead of local Chrome. Eliminates version sync problem.

**Lighthouse ESM-Only (v10+):**
- Risk: `package.json` allows lighthouse@^13.0.3 (ESM-only). Some hosting platforms don't support dynamic import in CJS. Fallback code path (line 33) assumes v9 is available.
- Impact: PerformanceEngine may fail to load on certain deployments.
- Migration plan: Update to full ESM module (requires converting all CJS imports). Or pin lighthouse@^9.6.0 (CJS support).

**Bull Queue Persistence:**
- Risk: Bull uses Redis for queue storage. If Redis is restarted, failed jobs with `removeOnFail: 20` are lost (20 most recent kept). No durable backup of job history.
- Impact: Long-running audits interrupted by Redis restart are orphaned (marked running forever).
- Migration plan: Implement job archival to PostgreSQL. Create a background job that periodically exports completed/failed jobs to audit_logs table.

**Missing Service Availability Patterns:**
- Risk: No circuit breaker for external APIs (Gemini, Anthropic, SerpService, Slack, Meta, Google). Single API failure blocks all dependent features.
- Impact: One flaky provider can cascade failures across the system.
- Migration plan: Add `circuit-breaker` package. Wrap all external HTTP calls. Fail fast with fallback when circuit opens.

**Zod Dependency (v4.3.6 - Old Version):**
- Risk: `package.json` pins zod@^4.3.6. Current stable is v3.x (v4 was experimental). Library may have breaking changes in future.
- Impact: Type validation could become incompatible on major version bump.
- Migration plan: Evaluate migration to latest Zod v3. Or migrate to Joi (already used in some validators — mixed approach).

## Missing Critical Features

**No Idempotency Keys for Async Operations:**
- Problem: Bulk operations (sync multiple integrations, run multiple audits) have no idempotency. Retry on network failure could duplicate operations.
- Blocks: Production reliability. Can't safely retry requests without user confirmation.

**No Webhook Integrity Verification:**
- Problem: `src/queues/processors/integrationSyncProcessor.js` trusts incoming webhook data from Meta/Google without signature verification.
- Blocks: Malicious actors could inject fake webhook data to poison analytics.

**No Audit Trail for Data Mutations:**
- Problem: Schema has `auditLogs` table defined but no code writes to it. All user actions (delete campaign, update alert) are unlogged.
- Blocks: Compliance requirements. No way to investigate who changed what when.

**No Automatic Token Refresh for Integrations:**
- Problem: Meta/Google tokens expire. `tokenHealthCheckProcessor.js` checks expiry but doesn't auto-refresh. User gets error.
- Blocks: Seamless integration experience. Forces manual reconnect.

**No Rate Limiting on Analytics Queries:**
- Problem: `src/controllers/dashboardController.js` can be called repeatedly to trigger expensive aggregation. No query rate limit per team.
- Blocks: Bad actors could DoS the analytics engine.

## Test Coverage Gaps

**SEO Audit Timeout Scenario:**
- What's not tested: Behavior when Puppeteer hangs and TOTAL_TIMEOUT_MS fires. Current tests mock fast execution.
- Files: `src/services/seo/audit/AuditOrchestrator.js`, no timeout-specific tests
- Risk: Timeout handler code path untested. Could fail to update audit record or leave zombie browsers.
- Priority: HIGH

**Concurrent Integration Sync with Upsert:**
- What's not tested: Two sync jobs for the same campaign running simultaneously. Upsert may have race condition on uniqueness constraint.
- Files: `src/queues/processors/integrationSyncProcessor.js` line 20-33
- Risk: Metrics snapshot could be lost or duplicated if sync jobs overlap.
- Priority: HIGH

**API Key Rotation in TokenEncryptionService:**
- What's not tested: Changing ENCRYPTION_KEY and attempting to decrypt old tokens.
- Files: `src/services/integrations/TokenEncryptionService.js`
- Risk: Token rotation scenario completely untested. Production rotation could break all integrations.
- Priority: MEDIUM

**Error Handling in Large Crawls:**
- What's not tested: Crawl with 500+ pages where one page fails. Should not abort the entire crawl.
- Files: `src/services/seo/audit/engines/CrawlEngine.js`
- Risk: Single broken page could fail entire audit instead of marking as broken link.
- Priority: MEDIUM

**Budget Protection Thresholds Edge Cases:**
- What's not tested: ROAS exactly at threshold, CPA exactly at threshold. Mock implementation uses deterministic scores, no real edge case coverage.
- Files: `src/services/ai/BudgetProtectionService.js`
- Risk: Off-by-one errors in threshold logic. Users miss alerts on boundary values.
- Priority: MEDIUM

---

*Concerns audit: 2026-03-15*
