# Architecture

**Analysis Date:** 2026-03-15

## Pattern Overview

**Overall:** Layered MVC + Service-Oriented with Adapter and Strategy patterns

**Key Characteristics:**
- **Request → Controller → Service → Repository → Database** (standard layering)
- **Adapter Pattern** for platform integrations (Meta, Google, Slack) — allows adding new platforms without modifying core logic
- **Strategy Pattern** for rule evaluation — trigger types (CPA, ROAS, CTR, etc.) can be added without changing RuleEngine
- **Orchestrator Pattern** for complex workflows (SEO audit pipeline, integration syncing)
- **Async Job Queue** (Bull/Redis) for long-running tasks decoupled from HTTP request/response cycles
- **AsyncLocalStorage (ALS)** for request tracing — correlationId and teamId automatically propagate through all log calls without manual threading

## Layers

**HTTP & Security (src/app.js):**
- Purpose: Express app setup, middleware chain, route mounting
- Location: `src/app.js`
- Contains: Helmet security, CORS, body parsing, rate limiting, error handlers, health endpoints
- Depends on: All routes, middleware, Sentry
- Used by: `src/server.js` (entry point)

**Routes (src/routes/):**
- Purpose: HTTP verb/path binding → controller method dispatch
- Location: `src/routes/*.js` (18+ route files: auth, campaigns, ads, analytics, seo, rules, integrations, etc.)
- Contains: Path definitions, middleware chain per route, parameter extraction
- Depends on: Controllers, authentication/authorization middleware
- Used by: `src/app.js` (mounted at `/api/v1/*`)
- Pattern: Each route file exports Express Router with handler decorators for auth/RBAC/validation

**Controllers (src/controllers/):**
- Purpose: Parse request, delegate to service, format response
- Location: `src/controllers/*.js` (campaign, ad, auth, seo, etc.)
- Contains: `list()`, `getOne()`, `create()`, `update()`, `remove()` (standard CRUD); plus domain-specific actions (launch, pause, scan, analyze)
- Depends on: Services, error handling
- Used by: Routes
- Pattern: All async; errors passed to `next(err)` for global error handler; responses follow `{ success, data, error, meta }` envelope

**Services (src/services/):**
- Purpose: Business logic — domain operations, calculations, orchestration
- Location: `src/services/{ai,analytics,budgetProtection,integrations,keywords,notification,rules,scaling,seo,team}/*.js`
- Contains: Data transformation, rule evaluation, external API calls, notification dispatch
- Depends on: Repositories, external SDKs (Gemini, Anthropic, Puppeteer, etc.), other services
- Used by: Controllers, queue processors, other services
- Patterns:
  - **IntegrationService** — abstracts platform adapter selection; encrypts/decrypts tokens via AES-256-GCM
  - **RuleEngine** — singleton; evaluates triggered conditions; delegates to Strategy subclasses; applies idempotency via cooldown window
  - **AuditOrchestrator** — orchestrates multi-stage SEO v2 pipeline: crawl → analyze → score → optionally summarize; wall-clock timeout; Puppeteer browser lifecycle management
  - **MetricsCalculator** — pure functions for analytics: ROAS, CPA, CTC, Exponential Moving Average, spend velocity
  - **TokenEncryptionService** — AES-256-GCM encryption/decryption for oauth tokens (secrets stored encrypted in DB)

**Repositories (src/repositories/):**
- Purpose: Prisma ORM abstraction — CRUD + soft-delete + pagination + team-scoping
- Location: `src/repositories/{base,user,team,campaign,ad,ResearchReport,CampaignIntelligence}Repository.js`
- Contains: Prisma queries wrapped in repo methods; soft-delete aware (where: { deletedAt: null })
- Depends on: Prisma client singleton
- Used by: Services
- Pattern: **BaseRepository** (generic) extended by model-specific repos (campaign, ad, user); pagination via findMany() returns { items, total }

**Middleware (src/middleware/):**
- Purpose: Cross-cutting concerns — authentication, validation, rate limiting, error handling, request tracing
- Location: `src/middleware/*.js` (auth, errorHandler, rateLimiter, sanitize, validate, correlationId, timing)
- Key files:
  - `auth.js` — JWT verification; RBAC guards (requireRole); team ownership guards
  - `errorHandler.js` — normalizes Prisma errors; logs operational vs unexpected errors; Sentry capture; unified error response
  - `correlationId.js` — stamps X-Correlation-Id on request; attaches to ALS store for tracing
  - `rateLimiter.js` — apiLimiter (120/min global), authLimiter (10/15min), heavyLimiter (20/min)
  - `sanitize.js` — XSS sanitization via `xss` package
  - `validateZod.js` — Zod schema validation decorator (returns 422 on validation error)
- Used by: `src/app.js` (mounted globally or per-route)

**Configuration (src/config/):**
- Purpose: Centralized env/singleton initialization
- Location: `src/config/*.js`
- Key files:
  - `index.js` — Joi-validated environment schema; throws at startup if required vars missing
  - `redis.js` — Singleton ioredis client (lazy-initialized)
  - `prisma.js` — Prisma client singleton
  - `logger.js` — Winston logger with ALS context injection
  - `als.js` — AsyncLocalStorage for request tracing (traceId, correlationId, teamId)
  - `sentry.js` — Sentry error tracking initialization
  - `featureFlags.js`, `seo.js`, `limits.js` — Feature toggles and plan-based limits
- Depends on: None (standalone)
- Used by: Services, middleware, everywhere else

## Data Flow

**Campaign Creation Flow:**

1. Frontend (`client/src/pages/CampaignsPage.jsx`) → POST /api/v1/campaigns
2. `src/routes/campaignRoutes.js` → `src/controllers/campaignController.js::create()`
3. `campaignController.create()` → `src/services/campaignService.js::createCampaign(teamId, body)`
4. `campaignService.createCampaign()` → `src/repositories/campaignRepository.js::create(data)`
5. `campaignRepository.create()` → `prisma.campaign.create({ data: {...} })`
6. Prisma inserts row, returns campaign object
7. Response flows back: Repository → Service → Controller → Route → HTTP 201
8. Frontend receives campaign, updates local state, re-renders

**SEO Audit Workflow (Async):**

1. Frontend: POST /api/v1/seo/audit → `src/controllers/seoController.js::createAudit()`
2. Controller creates `SeoAudit` record (status: pending), returns auditId immediately (202 Accepted)
3. Enqueues Bull job: `queues.seoAudit.add({ auditId, teamId, url })`
4. Bull worker picks up job → `src/queues/processors/seoAuditProcessor.js`
5. Processor calls `AuditOrchestrator.run(job)` wrapped in ALS context
6. Orchestrator pipeline:
   - **Crawl**: PuppeteerAdapter opens browser, BFS crawl via CrawlEngine, extracts DOM + links
   - **Analyze**: TechnicalAnalyzer runs 16 rules (technical, content, structure), detects issues
   - **Performance**: PerformanceEngine runs Lighthouse (separate browser), scores metrics
   - **Score**: ScoringEngine weights categories, calculates final 0-100 score, assigns grade (A-F)
   - **Summarize** (opt-in): SeoSummaryService calls Claude for executive summary if SEO_SUMMARY_ENABLED=true
   - All intermediate stages update status + progress (5%, 10%, 45%, etc.) in DB
7. On completion: status→completed, score+grade+issues+performanceData stored in SeoAudit record
8. On failure: status→failed, error logged
9. Frontend polls GET /api/v1/seo/audit/:id for progress; displays results when complete

**Rule Evaluation & Action Loop:**

1. Bull queue processor (ruleEvaluationProcessor) triggered on analytics refresh or manual invoke
2. `src/services/rules/RuleEngine.js::evaluate(campaignId, metrics)` loads active rules
3. For each rule:
   - RuleEngine selects strategy (CpaStrategy, RoasStrategy, etc.) from STRATEGIES map
   - Strategy.evaluate(rule, context) returns true/false
   - If true AND cooldown elapsed: fire action
   - Idempotency: lastTriggeredAt checked, rule waits 60min before firing again
4. Action dispatch:
   - Strategy returns { action, actionValue } (e.g., { action: 'pause_campaign', actionValue: null })
   - IntegrationService resolves platform adapter (Meta/Google)
   - Adapter calls platform API (e.g., MetaAdapter.pauseCampaign())
   - NotificationService creates in-app alert
5. Return list of fired rule results to caller

**Integration Token Sync Flow:**

1. Bull queue processor (tokenHealthCheckProcessor) runs daily at 02:00 UTC
2. Queries all integrations where nextRefreshAt ≤ now
3. For each integration:
   - Decrypt refreshToken via TokenEncryptionService.decrypt(encryptedToken)
   - IntegrationService resolves adapter → adapter.refresh(refreshToken)
   - On success: store new accessToken (encrypted), update nextRefreshAt, mark lastErrorAt=null
   - On failure: log error, set lastErrorAt, notify user
   - Store all tokens encrypted in DB

**State Management:**

- **Server State**: Prisma (PostgreSQL) — single source of truth for campaigns, ads, audits, integrations, users, teams, rules, notifications
- **Session State**: JWT tokens (stateless) — no session store needed; token payload contains userId, teamId, role
- **Cache**: Redis + Bull queues — job state, recurring cron definitions; also used by AnalyticsAggregator for cached overview
- **Client State**: Zustand stores (`client/src/store/authStore.js`) — auth token, user profile; most page data fetched fresh from API
- **Request Context**: AsyncLocalStorage — traceId (correlationId), teamId, jobId; propagated through all async calls for logging

## Key Abstractions

**Adapter (Platform Integration):**
- Purpose: Encapsulate platform-specific OAuth flow, API calls, account structure
- Examples: `src/services/integrations/adapters/{BaseAdapter,MetaAdapter,GoogleAdapter,SlackAdapter}.js`
- Pattern: BaseAdapter defines interface (connect, refresh, fetchData, createCampaign, pauseCampaign, updateBudget, validate); each platform implements
- Benefit: IntegrationService is platform-agnostic; adding TikTok just requires new adapter, no service logic change (Open/Closed Principle)

**Strategy (Rule Trigger Types):**
- Purpose: Encapsulate condition-checking logic for different rule triggers
- Examples: `src/services/rules/strategies/{CpaStrategy,RoasStrategy,CtrStrategy,FrequencyStrategy,BudgetPacingStrategy}.js`
- Pattern: BaseStrategy defines evaluate(rule, context) → boolean; each strategy type implements its metric formula
- Benefit: RuleEngine knows nothing about CPA math vs ROAS math; add new trigger via registry entry without modifying engine

**Orchestrator (Complex Workflows):**
- Purpose: Coordinate multiple engines/components through a staged pipeline
- Example: `src/services/seo/audit/AuditOrchestrator.js` orchestrates CrawlEngine → TechnicalAnalyzer → PerformanceEngine → ScoringEngine → SeoSummaryService
- Pattern: Mutable context object threaded through stages; each stage updates status, progress, and result fields; wall-clock timeout enforced
- Benefit: Decouples individual engines from pipeline orchestration; easier to test stages independently

**Engine (Focused Computation):**
- Purpose: Single-responsibility computation — crawling, analysis, scoring, performance measurement
- Examples: `src/services/seo/audit/engines/{CrawlEngine,TechnicalAnalyzer,PerformanceEngine,ScoringEngine}.js`
- Pattern: Each engine is stateless; returns deterministic output given input
- Benefit: Easy to unit test; reusable in different orchestrations

**Service Adapter (AI Provider Chain):**
- Purpose: Try multiple AI providers in fallback sequence (Ollama → Gemini → HuggingFace → Anthropic → mock)
- Examples: `src/services/ai/{OllamaService,GeminiService,HuggingFaceService,AnthropicService}`
- Pattern: Each service implements same interface (generateAds, analyzeCompetitor, etc.); calling code tries in order; marked with isMock flag if all fail
- Benefit: Resilient — if Gemini down, silently falls back to next provider; enables cost-optimized fallback chain

## Entry Points

**HTTP Server (src/server.js):**
- Location: `src/server.js`
- Triggers: `npm run dev` or `npm start`
- Responsibilities:
  - Startup sequence: HTTP server → Database → Queue processors → Recurring job scheduling
  - Health check endpoints (fast `/health`, detailed `/health/detailed`)
  - Graceful shutdown on SIGTERM/SIGINT (close server, disconnect DB, clear timeout)

**Queue Processors (src/queues/processors/):**
- Location: 8 processors registered in `src/queues/index.js::registerProcessors()`
- Triggers: Bull queue events (job enqueued, worker available)
- Responsibilities: Each processor wraps a business operation (SEO audit, keyword sync, rule eval, etc.)
- Notable: All processors wrapped in ALS context so logs auto-include traceId, jobId, teamId

**Recurring Jobs (Bull Cron):**
- Location: Scheduled via `src/queues/index.js::scheduleRecurringJobs()`
- Triggers:
  - Token health check: daily 02:00 UTC
  - SEO monitor sweep: every 4 hours
  - Integration sync sweep: every 6 hours
- Responsibilities: Bulk operations — refresh all expired tokens, scan all monitors for due runs, sync performance metrics for all integrations

**Frontend (client/src/App.jsx):**
- Location: React SPA, entry at `client/src/main.jsx`
- Triggers: Browser navigation
- Responsibilities:
  - Route protection (ProtectedRoute, PublicRoute guards check auth token)
  - Lazy load pages (Suspense + PageSpinner)
  - Global error listeners (offline banner, server error toast)
  - Command palette (Ctrl+K / Cmd+K)

## Error Handling

**Strategy:** Operational vs Unexpected distinction

**Patterns:**

1. **Operational Errors (4xx):**
   - Instance of AppError with statusCode 400-429
   - Examples: 400 (malformed input), 401 (no token), 403 (insufficient role), 404 (not found), 409 (duplicate), 422 (validation)
   - Response: `{ success: false, error: { message: "User-friendly error" } }`
   - Logging: Log at `info`/`warn` level; do NOT send to Sentry
   - Frontend: Display in toast/modal for user correction

2. **Unexpected Errors (5xx):**
   - Any non-operational error (programming bugs, infrastructure issues)
   - Prisma errors normalized:
     - P2002 (unique violation) → 409 conflict
     - P2025 (record not found) → 404 not found
     - P2003 (foreign key) → 400 bad request
   - Network errors (fetch failed, ECONNREFUSED) → 503 service unavailable
   - LLM response parse failures → 503 service unavailable
   - Response: `{ success: false, error: { message: "Something went wrong on the server. Please try again." } }` (generic; real error in server logs only)
   - Logging: Log at `error` level with full stack + context
   - Sentry: Always captured with context (correlationId, user, request)
   - Frontend: Display generic error; user can retry or contact support

3. **Async Job Errors:**
   - Bull retry logic: 3 attempts with exponential backoff (5s, 50s, 500s)
   - Processor catches and logs; on final attempt, marks failed
   - Failed jobs visible in queue health check; operator alerted

4. **Type Validation Errors:**
   - Joi (request body) → 400 bad request
   - Zod (query params, headers) → 422 unprocessable entity
   - Response includes validation details for debugging (dev only; scrubbed in prod)

## Cross-Cutting Concerns

**Logging:**
- Winston logger (`src/config/logger.js`) with pino formatting
- Every log call automatically includes `{ traceId, correlationId, teamId, jobId }` via AsyncLocalStorage
- Log levels: debug (dev), info (workflow milestones), warn (operational issues), error (failures)
- Slow requests (>3s) flagged at warn level
- Hanging connections (client closed before response sent) logged

**Validation:**
- Request body: Joi schemas in `src/validators/*.js` (auth, campaigns, etc.)
- Query/params: Zod schemas inline in route handlers or middleware
- Middleware chain: validateZod or validate decorators applied per-route
- Error response: 400 (Joi) or 422 (Zod) with validation details

**Authentication:**
- JWT Bearer token via Authorization header
- `authenticate` middleware extracts, verifies, attaches `req.user = { userId, teamId, role }`
- ALS store stamped with teamId for log context
- Tokens: accessToken (15m), refreshToken (7d)
- Refresh endpoint: POST /api/v1/auth/refresh

**Authorization:**
- `requireRole(...roles)` guard: checks req.user.role against allowed list (admin, manager, member)
- `requireTeamOwnership(getTeamId)` guard: verifies resource.teamId === req.user.teamId
- Applied per-route in route files

**Rate Limiting:**
- Global API limiter: 120 requests per minute per IP
- Auth limiter: 10 requests per 15 minutes (protects /login, /register, /refresh)
- Heavy limiter: 20 requests per minute (SEO audit, content generation)
- Implemented via express-rate-limit; respects trust proxy for Railway/Render

**Data Encryption:**
- OAuth tokens: AES-256-GCM encryption via `TokenEncryptionService`
- ENCRYPTION_KEY env var (64 hex chars = 256 bits)
- Stored encrypted in `Integration.accessToken` and `Integration.refreshToken` columns
- Decrypted on retrieval for API calls

---

*Architecture analysis: 2026-03-15*
