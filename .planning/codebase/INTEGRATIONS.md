# External Integrations

**Analysis Date:** 2026-03-15

## APIs & External Services

**AI/LLM Providers (Priority Chain):**
1. **Ollama** — Local LLM, highest priority (free, zero cost)
   - SDK/Client: Native `fetch` to `http://localhost:11434`
   - Models: Configurable via `OLLAMA_MODEL` env (default: `llama3.2`)
   - Graceful fallback: If unavailable, skips to next provider
   - File: `src/services/ai/OllamaService.js`

2. **Groq** — Free 14,400 req/day, 750 tok/s
   - SDK/Client: `groq-sdk` package
   - Auth: `GROQ_API_KEY` env var (no credit card)
   - Models: Task-routed (reasoning, creative, structured, general)
   - File: `src/services/ai/GroqService.js`

3. **Together AI** — $5 free credits, then $0.0002/1k tokens
   - SDK/Client: Native `fetch` to `https://api.together.xyz/v1/chat/completions`
   - Auth: `TOGETHER_API_KEY` env var
   - Models: Qwen, DeepSeek, Llama, Mixtral (task-routed)
   - File: `src/services/ai/TogetherAIService.js`

4. **Google Gemini** — Free 15 req/min, 1M tokens/day
   - SDK/Client: REST API via `fetch`
   - Auth: `GEMINI_API_KEY` env var (free account, no credit card)
   - Models: Fallback chain (gemini-2.5-flash → 2.0-flash → 2.0-flash-lite)
   - File: `src/services/ai/GeminiService.js`

5. **Cerebras** — Free 1M tokens/day, 30 req/min
   - SDK/Client: Native `fetch` to `https://api.cerebras.ai/v1/chat/completions`
   - Auth: `CEREBRAS_API_KEY` env var (free account, no credit card)
   - Models: Qwen-3, Llama-3.3 (task-routed)
   - File: `src/services/ai/CerebraService.js`

6. **HuggingFace Inference** — Free tier (rate limited ~30 req/min)
   - SDK/Client: OpenAI-compatible endpoint `https://router.huggingface.co/v1`
   - Auth: `HUGGINGFACE_API_KEY` env var
   - Model: `mistralai/Mistral-7B-Instruct-v0.3` (default, configurable)
   - File: `src/services/ai/HuggingFaceService.js`

7. **Anthropic Claude** — Paid fallback (~$0.001/call), last resort
   - SDK/Client: `@anthropic-ai/sdk` package
   - Auth: `ANTHROPIC_API_KEY` env var
   - Model: `claude-haiku-4-5-20251001` (fast, cheap)
   - File: `src/services/ai/AnthropicService.js`

**Search & Keyword Tracking:**
- **ValueSERP** — Real Google rank data, 50 free/month
  - SDK/Client: Native `fetch` to ValueSERP API
  - Auth: `VALUESERP_API_KEY` env var
  - Returns: Exact position + snippet from Google SERPs
  - File: `src/services/keywords/SerpService.js`

- **DuckDuckGo (HTML Scraper)** — Free fallback (no API key)
  - SDK/Client: HTML scraping with Cheerio
  - No auth required
  - Used when ValueSERP unavailable
  - File: `src/services/keywords/SerpService.js`, `GoogleScraper` module

**Ad Network APIs:**
- **Meta (Facebook) Graph API** — v18.0
  - OAuth Client: `META_APP_ID`, `META_APP_SECRET` env vars
  - Redirect URI: Passed at OAuth exchange time
  - Token lifecycle: 60-day long-lived tokens, auto-refresh
  - Uses: Campaign performance data, ad account sync
  - File: `src/services/integrations/adapters/MetaAdapter.js`

- **Google Ads API** — v14
  - OAuth Client: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` env vars
  - Redirect URI: Passed at OAuth exchange time
  - Token: `access_token` + `refresh_token` (standard 60min expiry, auto-refresh)
  - Uses: Campaign data, budget management
  - File: `src/services/integrations/adapters/GoogleAdapter.js`

**Traffic Signal Adapters (Optional):**
- **Cloudflare Radar** — Global domain popularity rank
  - Auth: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` env vars
  - Gracefully degraded if absent (no errors)
  - File: `src/services/research/adapters/CloudflareRadarAdapter.js`

- **Similarweb DigitalRank** — Website traffic rank
  - Auth: `SIMILARWEB_API_KEY` env var
  - Paid API (~$50/mo+)
  - File: (configured but not actively used)

## Data Storage

**Databases:**
- **PostgreSQL 16-alpine** — Primary datastore
  - Connection: `DATABASE_URL` env var (format: `postgresql://user:password@host:5432/adpilot`)
  - Client: Prisma 6.19.2 ORM
  - Schema: `prisma/schema.prisma` (14+ models: Team, User, Campaign, Ad, Rule, Integration, etc.)
  - All UUIDs for primary keys, snake_case columns mapped to camelCase in Prisma
  - Migrations: Use `npx prisma db push` (NOT `migrate dev` — shadow DB incompatible)

- **Redis 7-alpine** — Session + queue store
  - Connection: `REDIS_URL` env var (default: `redis://localhost:6379`)
  - Client: ioredis 5.0.0
  - Uses: Bull job queue backend, caching (node-cache wrapper), session tokens

**File Storage:**
- Local filesystem only (images served via `imageUrl` field in Ad model, assumed external URLs)
- No S3 or external blob storage configured

**Caching:**
- **Redis** — Via ioredis, used by Bull queues
- **In-memory cache** — node-cache 5.1.2 for temporary results (e.g., Ollama availability checks, 60s TTL)

## Authentication & Identity

**Auth Provider:** Custom JWT-based
- Implementation: Express middleware at `src/middleware/auth.js`
- Token generation: jsonwebtoken 9.0.0
- Secrets: `JWT_SECRET` (15m access), `JWT_REFRESH_SECRET` (7d refresh)
- Requirement: Both ≥32 chars, enforced at startup via Joi validation
- Payload: `{ userId, teamId, role }`
- Endpoints: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/refresh`

**OAuth Integrations:**
- **Meta** — For ad account linking
- **Google** — For Google Ads linking
- **Slack** — For team notifications (adapter exists)
- Token encryption: AES-256-GCM via `src/services/integrations/TokenEncryptionService.js`
- `ENCRYPTION_KEY` env var: 64-char hex string (32 bytes) for OAuth token encryption

## Monitoring & Observability

**Error Tracking:**
- Sentry (optional) — `@sentry/node` 10.40.0
  - Init: `SENTRY_DSN` env var (empty = no-op mode)
  - Tracing: 100% in dev, 10% in production
  - Ignores: JsonWebTokenError, TokenExpiredError, common 4xx errors
  - File: `src/config/sentry.js`

**Logs:**
- **Pino 10.3.1** — Structured JSON logging (primary)
  - Development: Pretty-printed colorized output (pino-pretty)
  - Production: Compact JSON to stdout
  - Context injection: AsyncLocalStorage auto-injects `traceId`, `jobId`, `teamId`, `provider`
  - File: `src/config/logger.js`

- **Winston 3.0.0** — Legacy logger (transitioning to Pino)

**Performance:**
- Healthcheck endpoint: `GET /health` (used by Railway with 60s timeout)
- Request timing: `src/middleware/timing.js` logs request duration + status

## CI/CD & Deployment

**Hosting:**
- Railway (primary platform)
- Health check: `/health` endpoint with 60s timeout
- Restart policy: ON_FAILURE with max 3 retries
- Environment injection: `railway.json` specifies Dockerfile

**CI Pipeline:**
- None detected (no GitHub Actions, no CircleCI)
- Docker image built by Railway from Dockerfile

**Build Process:**
- Multi-stage Dockerfile:
  - Stage 1: Build React frontend with Vite (`client/dist/`)
  - Stage 2: Install backend deps, generate Prisma client, copy compiled frontend, expose port 3000
- System deps: Puppeteer + Lighthouse require Chrome OS libs (ca-certificates, libxss1, etc.)
- Database setup: `src/scripts/waitForDatabase.js` pings DB before app start
- Schema sync: Manual `npx prisma db push` (not automatic on app boot)

## Environment Configuration

**Required env vars:**
- `DATABASE_URL` — PostgreSQL connection string
- `REDIS_URL` — Redis connection (default: `redis://localhost:6379`)
- `JWT_SECRET` — ≥32 random chars (startup validation enforced)
- `JWT_REFRESH_SECRET` — ≥32 random chars (different from JWT_SECRET)
- `ENCRYPTION_KEY` — Exactly 64 hex chars (32 bytes) for OAuth token encryption
- `ALLOWED_ORIGINS` — CORS whitelist (comma-separated)
- `INVITE_BASE_URL` — Frontend URL for team invite links

**Optional env vars (graceful degradation if absent):**
- `GROQ_API_KEY` — Groq LLM (skips if absent)
- `GEMINI_API_KEY` — Google Gemini (skips if absent)
- `TOGETHER_API_KEY` — Together AI (skips if absent)
- `CEREBRAS_API_KEY` — Cerebras (skips if absent)
- `ANTHROPIC_API_KEY` — Anthropic Claude (skips if absent, last resort)
- `HUGGINGFACE_API_KEY` — HuggingFace (skips if absent)
- `OLLAMA_URL` — Local Ollama endpoint (default: `http://localhost:11434`)
- `OLLAMA_MODEL` — Ollama model name (default: `llama3.2`)
- `VALUESERP_API_KEY` — Google SERP rank tracking (falls back to DuckDuckGo HTML scrape)
- `RESEND_API_KEY` — Email delivery (dev falls back to console logging)
- `SENTRY_DSN` — Error tracking (empty = disabled)
- `META_APP_ID`, `META_APP_SECRET` — Meta OAuth
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` — Google OAuth
- `SLACK_CLIENT_ID` — Slack integration
- `SEO_ENGINE_V2` — Enable v2 audit engine (true/false, default: true)
- `LIGHTHOUSE_ENABLED` — Enable Lighthouse perf audits (true/false)
- `SEO_SUMMARY_ENABLED` — Enable Claude-powered SEO summaries (true/false, cost consideration)

**Secrets location:**
- `.env` file (local development, NOT committed)
- Railway environment variables dashboard (production)
- `.env.example` — Public template showing required structure

## Webhooks & Callbacks

**Incoming:**
- OAuth redirect URIs — `POST` or `GET` to callback endpoints for Meta, Google, Slack
- Notification webhooks — Not actively implemented (framework exists)

**Outgoing:**
- Email via Resend API — `POST` to `https://api.resend.com/emails`
- No third-party webhooks configured for real-time data sync

**Queue Jobs (Asynchronous):**
- Bull queues via Redis trigger job processors:
  - `seoAuditProcessor` — Crawl + Lighthouse audit
  - `keywordSyncProcessor` — Rank tracking via ValueSERP/DuckDuckGo
  - `ruleEvaluationProcessor` — Budget/ROAS/CTR rule checks
  - `analyticsRefreshProcessor` — Metrics aggregation
  - `integrationSyncProcessor` — OAuth token refresh

---

*Integration audit: 2026-03-15*
