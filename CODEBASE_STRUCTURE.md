# AdPilot Codebase Structure

This document is the repo map for `/Users/adityatiwari/Adpilot`. It lists the full root structure, the active tech stack, and the purpose of each major area in one line.

---

## Tech Stack

| Layer | Technology | One-line purpose |
|-------|------------|------------------|
| Runtime | Node.js 20+ | Runs the backend API and queue workers. |
| Backend framework | Express 4 | Exposes REST endpoints, middleware, and static serving. |
| ORM | Prisma 6 | Defines the schema and handles PostgreSQL access. |
| Database | PostgreSQL 16 | Stores teams, users, campaigns, SEO data, alerts, and reports. |
| Cache / queues | Redis 7 + Bull | Powers background jobs, queue state, and short-lived cached work. |
| Frontend | React 18 + Vite 5 | Builds the SPA dashboard and public product pages. |
| Styling | Tailwind CSS 3 | Provides utility-first styling for the frontend UI. |
| Client state | Zustand | Holds lightweight client auth/session state. |
| Server state | TanStack React Query | Handles API fetching, caching, invalidation, and polling. |
| Charts | Recharts | Renders analytics charts and trend visualizations. |
| Auth | JWT + bcrypt | Handles stateless login and password hashing. |
| Validation | Zod + Joi | Validates request bodies and route payloads. |
| SEO crawl engine | Puppeteer + Cheerio + Lighthouse | Crawls pages, extracts structure, and measures performance. |
| AI providers | Ollama, Gemini, Hugging Face, Anthropic, Groq SDK | Supports ad generation, summaries, and AI-assisted research fallbacks. |
| Email | Resend | Sends transactional email flows. |
| Monitoring | Sentry | Captures backend errors and runtime failures. |
| Logging | Pino + Winston | Produces structured logs and readable local output. |
| Containers | Docker + Docker Compose | Runs local Postgres and Redis and supports deployment builds. |
| Testing | Jest + Supertest | Covers backend unit and HTTP integration tests. |

---

## Full Root Structure

This is the complete root-level layout currently present in the repo.

```text
Adpilot/
├── .claude/                         # Local Claude/Codex workspace helpers and agent notes
├── .dockerignore                    # Docker build context exclusions
├── .env                             # Local environment variables for development
├── .env.example                     # Environment variable template
├── .gitignore                       # Git ignore rules
├── API_KEYS.md                      # Notes for external API credentials
├── Caddyfile                        # Caddy server config
├── CODEBASE_STRUCTURE.md            # This code structure and tech stack guide
├── Dockerfile                       # Main production container build
├── FEATURE_STATUS.md                # Feature completion/status notes
├── LAUNCH.md                        # Launch messaging and go-to-market notes
├── PLAN.md                          # Master project plan and session ledger
├── PORTS.md                         # Port reference for local services
├── README.md                        # Main project overview and onboarding doc
├── client/                          # React/Vite frontend app
├── docker-compose.yml               # Local Postgres + Redis services
├── google-cloud-cli-558.0.0-darwin-arm.tar.gz  # Bundled Google CLI archive
├── index.html                       # Static landing page served in dev
├── login.html                       # Static login page served in dev
├── maxleads/                        # Misc deployment/server config
├── nodemon.json                     # Backend dev server watcher config
├── package-lock.json                # Backend dependency lockfile
├── package.json                     # Backend package manifest and scripts
├── prisma/                          # Prisma schema and SQL migrations
├── railway.json                     # Railway deployment config
├── seed.js                          # Root-level seed entry point
├── src/                             # Express backend source code
├── test_ai_providers.js             # Local AI provider verification script
├── test_ddg.js                      # Local search-related test script
└── test_gemini.js                   # Local Gemini integration test script
```

Generated folders also present locally but not useful for source navigation:

- `.git/` stores repository metadata.
- `node_modules/` stores backend dependencies.
- `client/node_modules/` stores frontend dependencies.
- `dist/` and `client/dist/` store build output.

---

## Source Structure

### `client/` frontend

```text
client/
├── index.html                       # Vite HTML entry
├── package.json                     # Frontend dependencies and scripts
├── postcss.config.js                # PostCSS pipeline config
├── tailwind.config.js               # Tailwind theme/config
├── vercel.json                      # Vercel hosting config
├── vite.config.js                   # Vite bundler config
└── src/
    ├── App.jsx                      # Main router, lazy pages, guards, command palette wiring
    ├── main.jsx                     # React bootstrap
    ├── index.css                    # Global styles, utilities, animations
    ├── components/                  # Reusable UI and layout building blocks
    ├── config/                      # Frontend feature identity config
    ├── lib/                         # Axios client and CSV export helpers
    ├── pages/                       # Route-level screens
    └── store/                       # Zustand stores
```

Key frontend directories:

| Path | Purpose |
|------|---------|
| `client/src/pages` | Holds all major screens like Dashboard, SEO, Research, Budget AI, and Settings. |
| `client/src/components/layout` | Provides `AppLayout`, `Sidebar`, and `TopBar` shell components. |
| `client/src/components/ui` | Holds shared presentation components like toasts, badges, headers, and skeletons. |
| `client/src/components/campaigns` | Contains campaign-specific modal UI. |
| `client/src/lib/api.js` | Central Axios instance with interceptors and auth token handling. |
| `client/src/config/features.js` | Defines branded feature metadata used across the UI. |
| `client/src/store/authStore.js` | Stores auth/session state on the client. |

### `src/` backend

```text
src/
├── app.js                           # Express app assembly, middleware, routes, static serving
├── server.js                        # Process startup, DB connect, queues, shutdown
├── Dockerfile                       # Additional backend container build file
├── cache/                           # Shared cache helpers
├── common/                          # AppError, pagination, response helpers
├── config/                          # Env, logger, Prisma, Redis, limits, feature flags
├── controllers/                     # Request handlers for each route group
├── dtos/                            # Reserved DTO area, currently unused
├── infrastructure/                  # Reserved infrastructure area, currently unused
├── integrations/                    # Reserved top-level integrations area, currently unused
├── middleware/                      # Auth, sanitization, validation, rate limiting, error handling
├── orchestrators/                   # Cross-service workflows
├── queues/                          # Bull queue registry and processors
├── repositories/                    # Data access abstractions over Prisma
├── routes/                          # Express route modules
├── scripts/                         # Backend operational scripts such as seeding
├── services/                        # Core business logic grouped by domain
├── utils/                           # Small helper utilities
└── validators/                      # Joi/Zod schemas and validator helpers
```

Key backend directories:

| Path | Purpose |
|------|---------|
| `src/config` | Centralizes boot-time config for env parsing, logging, Redis, Prisma, Sentry, and feature limits. |
| `src/middleware` | Applies request safety, auth, schema validation, correlation IDs, and response timing. |
| `src/routes` | Maps `/api/v1/...` endpoints to controllers. |
| `src/controllers` | Translates HTTP input into service calls and API responses. |
| `src/services` | Implements business logic for ads, SEO, analytics, alerts, AI, integrations, and team workflows. |
| `src/repositories` | Encapsulates DB access patterns to keep services thinner. |
| `src/queues` | Registers Bull queues and the processors that run async jobs. |
| `src/orchestrators` | Coordinates multi-step workflows that span more than one service. |
| `src/validators` | Defines payload schemas and validation middleware wiring. |

### `prisma/` data model

```text
prisma/
├── schema.prisma                    # Full PostgreSQL schema for the application
└── migrations/                      # SQL migrations applied over time
```

Prisma currently models the main app entities such as `Team`, `User`, `Campaign`, `Ad`, `SeoAudit`, `Keyword`, `KeywordRank`, `Rule`, `Notification`, `Integration`, `ResearchReport`, `ContentBrief`, `CampaignAlert`, and `SeoMonitor`.

---

## Domain Map

| Area | Main files | One-line explanation |
|------|------------|----------------------|
| Auth | `src/routes/authRoutes.js`, `src/controllers/authController.js`, `src/services/authService.js` | Handles registration, login, JWT issuing, and demo access. |
| Campaigns and ads | `src/routes/campaignRoutes.js`, `src/routes/adRoutes.js`, `src/services/campaignService.js`, `src/services/adService.js` | Manages campaign lifecycle, ads, and related performance data. |
| Dashboard and analytics | `src/routes/dashboardRoutes.js`, `src/routes/analyticsRoutes.js`, `src/services/analytics/*` | Aggregates KPIs, trend data, anomaly detection, and overview metrics. |
| SEO audit | `src/services/seo/audit/*`, `src/controllers/seoController.js` | Runs crawl, technical analysis, scoring, performance checks, and executive summaries. |
| SEO monitoring | `src/services/seo/monitoring/*`, `src/routes/monitorRoutes.js` | Schedules recurring audits and detects regressions and alert conditions. |
| Keyword workflows | `src/services/seo/KeywordTrackingService.js`, `src/services/keywords/*` | Tracks keywords, snapshots ranking history, and discovers terms from audits. |
| Research and competitor intel | `src/routes/researchRoutes.js`, `src/routes/competitorRoutes.js`, `src/services/ai/CompetitorAnalyzer.js` | Collects competitor-facing research, ad intelligence, and market insights. |
| Budget protection | `src/routes/budgetProtectionRoutes.js`, `src/services/budgetProtection/BudgetGuardian.js` | Detects spend/performance risk and surfaces alert actions. |
| Scaling predictor | `src/routes/scalingRoutes.js`, `src/services/scaling/ScalingAnalyzer.js` | Scores scale readiness from campaign performance factors. |
| Pulse monitoring | `src/routes/pulseRoutes.js`, `src/services/pulse/PulseService.js` | Runs recurring lightweight performance checks and alert creation. |
| Rules engine | `src/routes/ruleRoutes.js`, `src/services/rules/*` | Evaluates campaign rules using strategy-specific trigger logic. |
| Integrations | `src/routes/integrationRoutes.js`, `src/services/integrations/*` | Connects third-party platforms and stores encrypted tokens. |
| Notifications | `src/routes/notificationRoutes.js`, `src/services/notifications/NotificationService.js` | Powers in-app notifications and related delivery logic. |
| Team and user settings | `src/routes/teamRoutes.js`, `src/routes/userRoutes.js`, `src/services/team/*` | Supports members, invites, profile updates, and team management. |
| Reports | `src/routes/reportsRoutes.js`, `src/controllers/reportsController.js` | Exposes report-oriented endpoints for exports and summary views. |

---

## Queue and Background Work

| Queue / job | Main file | Purpose |
|-------------|-----------|---------|
| `seoAudit` | `src/queues/processors/seoAuditProcessor.js` | Runs asynchronous SEO audits. |
| `seoMonitor` | `src/queues/processors/seoMonitorProcessor.js` | Executes scheduled SEO monitor runs and regression checks. |
| `keywordSync` | `src/queues/processors/keywordSyncProcessor.js` | Refreshes keyword ranking data. |
| `ruleEvaluation` | `src/queues/processors/ruleEvaluationProcessor.js` | Evaluates automation rules against campaign performance. |
| `analyticsRefresh` | `src/queues/processors/analyticsRefreshProcessor.js` | Refreshes analytics aggregates in the background. |
| `integrationSync` | `src/queues/processors/integrationSyncProcessor.js` | Syncs external platform data. |
| `tokenHealthCheck` | `src/queues/processors/tokenHealthCheckProcessor.js` | Checks integration token validity and expiry. |
| `notifications` | `src/queues/processors/notificationsProcessor.js` | Sends or prepares asynchronous notifications. |

---

## Runtime Notes

| File | Why it matters |
|------|----------------|
| `src/app.js` | This is the real backend composition root where middleware and `/api/v1` routes are mounted. |
| `src/server.js` | This is the runtime entrypoint that starts HTTP first, then connects DB and queues. |
| `client/src/App.jsx` | This is the frontend composition root where all page routes are wired. |
| `prisma/schema.prisma` | This is the canonical database model for the whole app. |
| `PLAN.md` | This is the ongoing implementation log and roadmap, not a substitute for source truth. |

