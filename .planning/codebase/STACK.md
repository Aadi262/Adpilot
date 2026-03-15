# Technology Stack

**Analysis Date:** 2026-03-15

## Languages

**Primary:**
- JavaScript (CommonJS) — Node.js backend, uses `require()` not `import`
- JavaScript (ES Modules) — React frontend, uses `import` syntax

**Secondary:**
- SQL — PostgreSQL queries via Prisma ORM

## Runtime

**Environment:**
- Node.js ≥20.0.0

**Package Manager:**
- npm (backend)
- npm (frontend in `client/`)
- Lockfile: `package-lock.json` present

## Frameworks

**Core Backend:**
- Express.js 4.18.0 — REST API server
- Prisma 6.19.2 — PostgreSQL ORM with type-safe queries

**Frontend:**
- React 18.3.1 — UI framework
- Vite 5.4.8 — Build tool and dev server (port 5173)
- React Router 6.26.2 — Client-side routing
- TailwindCSS 3.4.13 — Utility-first CSS
- Zustand 5.0.0 — Lightweight state management

**Queuing & Async:**
- Bull 4.0.0 — Job queue built on Redis
- node-cron 4.2.1 — Scheduled task runner

**AI/LLM Integration:**
- @anthropic-ai/sdk 0.78.0 — Claude API client (fallback provider)
- groq-sdk 0.37.0 — Groq API client (free 14.4k req/day)
- google-trends-api 4.9.2 — Trend analysis
- Natural 6.12.0 — NLP utilities (TF-IDF, text processing)

**Web Scraping & Automation:**
- Puppeteer 24.37.5 — Browser automation for crawling + Lighthouse
- Lighthouse 13.0.3 — Website performance & SEO audits
- Cheerio 1.2.0 — jQuery-like DOM parsing (lightweight, server-side)

**Testing:**
- Jest 29.0.0 — Test framework
- Supertest 6.0.0 — HTTP assertion library

**Development:**
- Nodemon 3.0.0 — Auto-reload on file changes (configured in `nodemon.json`)
- Concurrently 9.2.1 — Run API + frontend in parallel (`npm run dev:all`)

## Key Dependencies

**Critical:**
- `ioredis` 5.0.0 — Redis client for Bull queues and caching
- `@prisma/client` 6.19.2 — Prisma database client (auto-generated from schema)
- `jsonwebtoken` 9.0.0 — JWT token generation/verification
- `bcrypt` 5.0.0 — Password hashing
- `joi` 17.0.0 — Input validation schema library
- `zod` 4.3.6 — TypeScript-first schema validation (alternative to Joi)

**Infrastructure:**
- `helmet` 7.0.0 — Security headers (XSS protection, CSP, etc.)
- `cors` 2.8.5 — Cross-Origin Resource Sharing
- `express-rate-limit` 7.5.1 — Rate limiting middleware
- `xss` 1.0.15 — XSS attack sanitization
- `uuid` 9.0.1 — UUID generation for IDs
- `axios` 1.0.0 — HTTP client library
- `dotenv` 16.0.0 — Environment variable loading
- `pino` 10.3.1 — Structured JSON logging framework
- `pino-pretty` 13.1.3 — Pretty-print Pino logs in development
- `winston` 3.0.0 — Legacy logger (transitioning to Pino)
- `node-cache` 5.1.2 — In-memory caching
- `resend` 6.9.2 — Email delivery service (optional, dev fallback to console)

**Frontend UI:**
- `@tanstack/react-query` 5.56.2 — Data fetching + caching
- `recharts` 2.12.7 — Composable React charts
- `lucide-react` 0.447.0 — Icon library
- `autoprefixer` 10.4.20 — CSS vendor prefixes
- `postcss` 8.4.47 — CSS transform pipeline

**Observability:**
- `@sentry/node` 10.40.0 — Error tracking + APM (optional, dev defaults to no-op)

## Configuration

**Environment:**
- `.env.example` — Template with all required + optional vars
- `ENCRYPTION_KEY` — 64-char hex string for OAuth token encryption (dev default: all zeros)
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — ≥32 chars, enforced at startup via Joi
- `NODE_ENV` — development | production (Dockerfile sets to production)

**Build:**
- `prisma/schema.prisma` — Database schema (PostgreSQL dialect)
- `package.json` scripts:
  - `npm run dev` → Nodemon watches `src/`
  - `npm run dev:all` → Concurrently runs API + frontend
  - `npm run build` → Prisma generate + Vite build
  - `npm run seed` → Load seed data via `src/scripts/seed.js`

**Vite Frontend:**
- `client/vite.config.js` — React + Vite setup, dev proxy to API at `http://localhost:3000`
- `client/package.json` — Frontend dependencies (isolated from backend)

**Nodemon:**
- `nodemon.json` — Watch `src/`, ignore `node_modules` and `.test.js`, restart on `.js` or `.json` changes

**Railway Deployment:**
- `railway.json` — Defines Dockerfile build path, healthcheck endpoint `/health`, restart policy
- `Dockerfile` — Two-stage build: frontend (Vite), backend (Node.js with Puppeteer system deps)

## Platform Requirements

**Development:**
- Node.js ≥20.0.0
- PostgreSQL 16 (via Docker: `postgres:16-alpine`)
- Redis 7 (via Docker: `redis:7-alpine`)
- Optional: Ollama (local LLM, runs on `localhost:11434`)
- Optional: Docker + Docker Compose for containerized services

**Production:**
- Railway platform (primary deployment target)
- PostgreSQL database (managed by Railway or external)
- Redis for Bull queues (managed by Railway or external)
- Node.js 20+ runtime

**Deployment:**
- Dockerfile: Multi-stage build with Puppeteer + Lighthouse support
- Container registry: Implicit (Railway pulls from git)
- Healthcheck: `/health` endpoint with 60s timeout
- Static asset serving: Express serves compiled React from `client/dist/`

## API Information

**Base URL:** `/api/v1/`

**Routes mounted at `/api/v1/`:**
- `auth` → authentication + token refresh
- `campaigns` → CRUD operations
- `ads` → ad management (both `campaigns/:id/ads` and direct `ads/:id`)
- `analytics` → performance metrics + aggregated insights
- `seo` → audit, keywords, competitor gaps, content briefs
- `rules` → rule engine CRUD
- `integrations` → OAuth providers (Meta, Google, Slack)
- `team` → team management + member invites
- `notifications` → notification preferences
- `users` → user profile
- `budget-ai` → budget protection alerts
- `research` → competitor research + hijack analysis
- `competitors` → competitor CRUD
- `scaling` → readiness prediction
- `monitor` → SEO monitor tracking
- `pulse` → activity feed
- `dashboard` → aggregated dashboard data
- `reports` → report generation

**Authentication:** Bearer token (JWT) in `Authorization` header, 15m access token + 7d refresh token

---

*Stack analysis: 2026-03-15*
