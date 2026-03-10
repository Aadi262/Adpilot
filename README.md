<div align="center">

# ⚡ AdPilot

**AI-Powered Ad & SEO Command Center**

Stop managing ads manually. Let AI agents research, create, optimize, and report — across Meta and Google — from one dashboard.

[![Node.js](https://img.shields.io/badge/Node.js-20%2B-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

[Live Demo](#) · [Documentation](#architecture) · [Code Structure](./CODEBASE_STRUCTURE.md) · [API Reference](#api-endpoints)

</div>

---

## What is AdPilot?

AdPilot is a full-stack marketing operations platform that combines campaign management, SEO tooling, competitor research, analytics, alerts, and AI-assisted workflows in one application.

**The problem:** Growth teams lose time and context switching across ad managers, SEO tools, reporting dashboards, and manual research workflows.

**The solution:** A single command center with route-based tools for campaign operations, SEO audits, keyword tracking, research, scaling analysis, budget monitoring, notifications, and reporting.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     CLIENT (React 18 + Vite + Tailwind)                     │
│  Landing → Auth → Dashboard → Campaigns → SEO → Research → Analytics       │
│  Ad Studio → Budget AI → Scaling → Notifications → Team → Settings         │
└──────────────────────────────┬───────────────────────────────────────────────┘
                               │ REST API + JWT
┌──────────────────────────────▼───────────────────────────────────────────────┐
│                         API LAYER (Express 4)                               │
│  Routes → Validators → Controllers → Services → Repositories               │
│  Middleware: Helmet, CORS, Rate Limit, Sanitize, Correlation ID, Timing    │
└──────┬─────────────┬─────────────┬──────────────┬─────────────┬─────────────┘
       │             │             │              │             │
┌──────▼─────┐ ┌─────▼─────┐ ┌────▼─────┐ ┌──────▼─────┐ ┌─────▼────────┐
│    Auth    │ │ Campaigns │ │   SEO    │ │ Research & │ │ Monitoring & │
│   Users    │ │ Ads/Rules │ │ Audits    │ │ AI Features │ │ Notifications │
└────────────┘ └───────────┘ └────┬──────┘ └────────────┘ └──────────────┘
                                  │
                    ┌─────────────▼────────────────┐
                    │        SEO Audit Pipeline     │
                    │ Crawl → Technical → Perf →    │
                    │ Score → Summary → Monitoring  │
                    └───────────────────────────────┘
┌──────────────────────────────────────────────────────────────────────────────┐
│                    BACKGROUND WORK (Bull + Redis)                           │
│ seoAudit │ seoMonitor │ keywordSync │ ruleEvaluation │ analyticsRefresh     │
│ integrationSync │ tokenHealthCheck │ notifications                         │
└──────────────────────────────────────────────────────────────────────────────┘
               │                                      │
┌──────────────▼──────────────┐        ┌──────────────▼──────────────┐
│ PostgreSQL 16 via Prisma 6 │        │ Redis 7 for queues/cache    │
└─────────────────────────────┘        └─────────────────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 20+ | Runs the API server and queue startup process |
| **Framework** | Express 4.18 | Hosts the REST API, middleware stack, and static serving |
| **ORM** | Prisma 6.19 | Maps application models to PostgreSQL |
| **Database** | PostgreSQL 16 | Primary relational store for all app data |
| **Cache/Queue** | Redis 7 + Bull | Handles background jobs and queue state |
| **Frontend** | React 18 + Vite 5 | Builds the dashboard SPA and public pages |
| **Styling** | Tailwind CSS 3 | Utility-first CSS |
| **Auth** | JWT + bcrypt | Stateless authentication |
| **Validation** | Zod + Joi | Request schema validation on API boundaries |
| **SEO Crawling** | Puppeteer + Cheerio + Lighthouse | Crawling, extraction, and performance auditing |
| **Client Data** | React Query + Zustand | API caching/polling plus lightweight client state |
| **Charts** | Recharts | Analytics and monitor visualizations |
| **Security** | Helmet + XSS + express-rate-limit | API hardening |
| **Logging** | Pino + Winston | Structured application logging |
| **Email** | Resend | Transactional email |
| **Monitoring** | Sentry | Error tracking |
| **Testing** | Jest + Supertest | Unit and integration tests |
| **Containers** | Docker Compose | Local development |
| **AI Providers** | Ollama, Gemini, Hugging Face, Anthropic, Groq SDK | Ad generation, summaries, and research fallbacks |

---

## Project Structure

```
Adpilot/
├── .claude/                      # Local agent memory and workspace notes
├── client/                       # React 18 + Vite frontend
├── prisma/                       # Prisma schema and migrations
├── src/                          # Express backend source
├── docker-compose.yml            # Local PostgreSQL + Redis
├── Dockerfile                    # Production container build
├── index.html                    # Static landing page served in dev
├── login.html                    # Static login page served in dev
├── package.json                  # Backend scripts and dependencies
├── nodemon.json                  # Backend hot-reload config
├── PLAN.md                       # Master implementation ledger
├── LAUNCH.md                     # Launch notes and copy
├── FEATURE_STATUS.md             # Feature progress notes
├── PORTS.md                      # Local port reference
├── railway.json                  # Railway deploy config
├── seed.js                       # Root seed entry
└── CODEBASE_STRUCTURE.md         # Full repo map and stack guide
```

### Frontend

```
client/src/
├── App.jsx                       # Router, lazy routes, guards, command palette
├── main.jsx                      # React app bootstrap
├── index.css                     # Global styles and animation utilities
├── components/
│   ├── campaigns/                # Campaign-specific modal UI
│   ├── layout/                   # Sidebar, TopBar, AppLayout
│   └── ui/                       # Shared reusable UI primitives
├── config/                       # Feature identity config
├── lib/                          # API client and CSV export helpers
├── pages/                        # Route-level screens
└── store/                        # Zustand state
```

### Backend

```
src/
├── app.js                        # Express composition root
├── server.js                     # Startup and graceful shutdown
├── config/                       # Env, Prisma, Redis, limits, logger, Sentry
├── middleware/                   # Auth, sanitize, validation, rate limit, timing
├── routes/                       # `/api/v1` route modules
├── controllers/                  # HTTP request handlers
├── services/                     # Business logic by domain
├── repositories/                 # Data access abstraction layer
├── queues/                       # Bull registry and processors
├── orchestrators/                # Cross-service workflows
├── validators/                   # Zod/Joi schemas and helpers
├── common/                       # Error and response helpers
├── cache/                        # Cache utilities
├── scripts/                      # Operational scripts
├── utils/                        # Shared utilities
├── dtos/                         # Reserved DTO area
├── infrastructure/               # Reserved infrastructure area
└── integrations/                 # Reserved top-level integrations area
```

### Deeper Structure

```
src/services/
├── ai/                           # AI provider integrations and analysis helpers
├── analytics/                    # KPI aggregation and anomaly detection
├── budgetProtection/             # Budget Guardian logic
├── email/                        # Transactional email delivery
├── integrations/                 # External platform integration services/adapters
├── keywords/                     # Keyword discovery and SERP helpers
├── notifications/                # In-app notification domain logic
├── pulse/                        # Pulse monitoring service
├── rules/                        # Automation rule engine and strategies
├── scaling/                      # Scaling readiness analysis
├── seo/                          # SEO audit, tracking, monitoring, summaries
├── team/                         # Team and invite workflows
├── adService.js                  # Ad business logic
├── authService.js                # Auth business logic
└── campaignService.js            # Campaign business logic
```

For the full current root map, see [CODEBASE_STRUCTURE.md](./CODEBASE_STRUCTURE.md).

---

## SEO Audit Engine

The SEO engine is a multi-stage pipeline that crawls pages, evaluates technical/content/structure issues, scores the site, and can optionally generate an executive summary.

### Pipeline

```
User triggers audit
        │
        ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   CrawlEngine   │ ──▶ │TechnicalAnalyzer │ ──▶ │ PerformanceEngine│ ──▶ │ ScoringEngine│
│ BFS crawl       │     │ Rule execution   │     │ Lighthouse + CWV │     │ Weighted     │
│ robots filtering│     │ issue creation   │     │ page metrics     │     │ category score│
└─────────────────┘     └──────────────────┘     └──────────────────┘     └──────┬───────┘
                                                                                  │
                                                                                  ▼
                                                                          ┌──────────────┐
                                                                          │ Summary / UI │
                                                                          │ API response │
                                                                          │ + monitoring │
                                                                          └──────────────┘
```

### Audit Rule Set

The audit engine currently includes technical, content, and structure rules across files in `src/services/seo/audit/rules`.

| Category | Rule | Severity | What It Checks |
|----------|------|----------|----------------|
| **Technical** | TitleRule | Critical | Missing/duplicate/too-long title tags |
| | MetaDescriptionRule | High | Missing or poorly sized meta descriptions |
| | HeadingRule | Medium | H1 count, heading hierarchy |
| | HeadingHierarchyRule | Medium | Heading level skips across the page |
| | HttpsRule | Critical | SSL certificate, HTTP→HTTPS redirects |
| | CanonicalRule | High | Missing or self-referencing canonicals |
| | RobotsTxtRule | Medium | robots.txt existence and validity |
| | SitemapRule | Medium | XML sitemap existence and format |
| | BrokenLinksRule | Critical | 404s, 5xx, dead internal links |
| | RedirectChainRule | High | Chains > 2 hops, redirect loops |
| | SecurityHeadersRule | Medium | Missing browser security headers |
| | ViewportRule | High | Missing mobile viewport meta tag |
| | OpenGraphRule | Low | Missing social sharing metadata |
| | SchemaMarkupRule | Low | Missing structured data markup |
| **Content** | WordCountRule | Medium | Thin content (< 300 words) |
| | ImageAltRule | Medium | Missing alt text on images |
| | DuplicateTitleRule | High | Identical titles across pages |
| | DuplicateMetaRule | High | Identical meta descriptions |
| | ImageDimensionsRule | Low | Missing explicit image dimensions |
| | LazyLoadingRule | Low | Missing lazy loading on images |
| **Structure** | OrphanPageRule | High | Pages with no internal links to them |
| | PageDepthRule | Medium | Pages > 3 clicks from homepage |
| | InternalLinkingRule | Medium | Poor internal link distribution |

### Adding Custom Rules

```javascript
const BaseRule = require('../BaseRule');

class MyCustomRule extends BaseRule {
  constructor() {
    super({
      id: 'custom-check',
      name: 'My Custom Check',
      category: 'technical',
      severity: 'high',
    });
  }

  evaluate(crawlResult) {
    const issues = [];
    for (const page of crawlResult.pages) {
      if (/* condition */) {
        issues.push(this.createIssue({
          url: page.url,
          message: 'What is wrong',
          recommendation: 'How to fix it',
        }));
      }
    }
    return issues;
  }
}
```

Add to `rules/registry.js` — automatically picked up by TechnicalAnalyzer.

---

## Automation Rule Engine

Uses the **Strategy Pattern** to evaluate campaigns and fire automated actions.

| Strategy | Trigger | Action |
|----------|---------|--------|
| **RoasStrategy** | ROAS drops below threshold | Pause campaign, send alert |
| **CpaStrategy** | CPA exceeds limit | Reduce budget, notify |
| **CtrStrategy** | CTR below baseline | Flag for creative refresh |
| **FrequencyStrategy** | Ad fatigue detected | Rotate creative |
| **BudgetPacingStrategy** | Burn rate too fast/slow | Adjust daily budget |

---

## API Endpoints

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/v1/auth/register` | Create account and team | No |
| `POST` | `/api/v1/auth/login` | Authenticate and receive JWT tokens | No |
| `POST` | `/api/v1/auth/demo-login` | Enter the shared demo workspace | No |
| `GET` | `/api/v1/campaigns` | List campaigns | Yes |
| `POST` | `/api/v1/campaigns` | Create a campaign | Yes |
| `PATCH` | `/api/v1/campaigns/:id` | Update a campaign | Yes |
| `GET` | `/api/v1/campaigns/:id/ads` | List campaign ads | Yes |
| `POST` | `/api/v1/campaigns/:id/ads` | Generate or create ads for a campaign | Yes |
| `GET` | `/api/v1/analytics/overview` | Return analytics KPI summary | Yes |
| `GET` | `/api/v1/dashboard` | Return dashboard command-center data | Yes |
| `POST` | `/api/v1/seo/audit` | Start an SEO audit | Yes |
| `GET` | `/api/v1/seo/audit/:id` | Fetch audit results | Yes |
| `GET` | `/api/v1/seo/keywords` | List tracked keywords | Yes |
| `POST` | `/api/v1/seo/monitors` | Create a scheduled SEO monitor | Yes |
| `GET` | `/api/v1/rules` | List automation rules | Yes |
| `POST` | `/api/v1/integrations/*` | Manage third-party integrations | Yes |
| `GET` | `/api/v1/notifications` | List notifications | Yes |
| `GET` | `/api/v1/budget-ai/scan` | Run budget protection scan | Yes |
| `GET` | `/api/v1/research/hijack-analysis` | Run competitor intel analysis | Yes |
| `GET` | `/api/v1/scaling/all-campaigns` | Return scaling readiness data | Yes |
| `GET` | `/api/v1/pulse` | Return pulse monitoring data | Yes |
| `GET` | `/api/v1/team` | Return current team data | Yes |
| `GET` | `/api/v1/users/me` | Return current user/profile data | Yes |

---

## Background Jobs

| Queue | Schedule | Purpose |
|-------|----------|---------|
| `seoAudit` | On-demand | Full site crawl + analysis + scoring |
| `seoMonitor` | Every 4 hours sweep + on-demand | Scheduled SEO monitoring and regression detection |
| `keywordSync` | Daily | Refresh keyword rankings |
| `ruleEvaluation` | Every 15 min | Campaign rule checks + actions |
| `analyticsRefresh` | Hourly | Pull platform metrics |
| `integrationSync` | Every 6 hours | Sync data from Meta/Google |
| `tokenHealthCheck` | Daily | OAuth token expiry monitor |
| `notifications` | Real-time | Email + in-app alerts |

---

## Design Patterns

| Pattern | Where | Why |
|---------|-------|-----|
| **Strategy** | Rule engine strategies | Swap evaluation logic per metric type |
| **Adapter** | Platform integrations + SEO crawlers | Uniform interface for different APIs |
| **Repository** | Data access layer | Decouple business logic from Prisma |
| **Pipeline** | SEO audit (Crawl → Analyze → Score) | Independent, testable stages |
| **Factory** | Rule registry | Auto-load rules by directory scan |
| **Singleton** | Prisma client, Redis connection | One pool per process |

---

## Getting Started

### Prerequisites

- Node.js >= 20
- Docker Desktop (for PostgreSQL + Redis)
- Git

### Quick Start

```bash
# Clone
git clone https://github.com/Aadi262/Adpilot.git
cd Adpilot

# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..

# Start databases
docker compose up -d

# Setup environment
cp .env.example .env

# Apply schema + seed demo data
npx prisma db push
npx prisma generate
npm run seed

# Start backend
npm run dev

# Start frontend (separate terminal)
cd client && npm run dev
```

### Environment Variables

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/adpilot"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-32-char-secret"
JWT_REFRESH_SECRET="your-32-char-refresh-secret"
ENCRYPTION_KEY="64-char-hex-key"
RESEND_API_KEY="re_xxxx"
ANTHROPIC_API_KEY=""
OPENAI_API_KEY=""
ALLOWED_ORIGINS="http://localhost:5173"
```

---

## Scripts

```bash
npm run dev            # Backend with hot reload
npm run dev:all        # Backend + frontend together
npm run start          # Production start
npm run build          # Prisma generate + frontend build
npm run seed           # Seed database
npm run test           # Run tests
npx prisma studio      # Database GUI
npx prisma db push     # Apply schema changes
```

---

## Authors

Built with ☕ and Claude Code by **Vedang Vaidya** & **Aditya Tiwari**

---

<div align="center">

**[⬆ Back to Top](#-adpilot)**

</div>
