<div align="center">

# ⚡ AdPilot

**AI-Powered Ad & SEO Command Center**

Stop managing ads manually. Let AI agents research, create, optimize, and report — across Meta and Google — from one dashboard.

[![Node.js](https://img.shields.io/badge/Node.js-23.x-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-4.18-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Prisma](https://img.shields.io/badge/Prisma-6.19-2D3748?logo=prisma&logoColor=white)](https://www.prisma.io/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7-DC382D?logo=redis&logoColor=white)](https://redis.io/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)]()

[Live Demo](#) · [Documentation](#architecture) · [API Reference](#api-endpoints) · [Contributing](#contributing)

</div>

---

## What is AdPilot?

AdPilot replaces 3–5 separate marketing tools with a single AI-powered platform. It automates competitor research, ad creative generation, campaign management, SEO auditing, and performance analytics — all from one dark-themed command center built for agencies and growth teams.

**The problem:** Marketing teams waste 15–25 hours per week on manual research, creative testing, bid management, and switching between Meta Ads Manager, Google Ads, Semrush, and Ahrefs.

**The solution:** Six AI agents that work 24/7 — researching competitors, generating ad copy, deploying campaigns, optimizing bids, auditing SEO, and delivering unified reports.

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        CLIENT (React 18 + Tailwind)                      │
│  Login → Dashboard → Campaigns → Ad Studio → SEO → Analytics → Rules    │
└──────────────────────────┬───────────────────────────────────────────────┘
                           │ REST API (JWT Auth)
┌──────────────────────────▼───────────────────────────────────────────────┐
│                        API LAYER (Express 4)                             │
│  Routes → Validators (Zod/Joi) → Controllers → Services                 │
│  Middleware: Helmet, CORS, Rate Limiter, XSS Sanitize, Correlation ID   │
└──────┬──────────┬──────────┬──────────┬──────────┬───────────────────────┘
       │          │          │          │          │
┌──────▼───┐ ┌───▼────┐ ┌───▼────┐ ┌───▼────┐ ┌──▼──────────┐
│   Auth   │ │Campaign│ │  SEO   │ │ Rules  │ │Integrations │
│ Service  │ │Service │ │ Engine │ │ Engine │ │  Service    │
└──────────┘ └────────┘ └───┬────┘ └───┬────┘ └──┬──────────┘
                            │          │          │
              ┌─────────────▼──┐  ┌────▼────┐  ┌─▼─────────────────┐
              │ Audit Pipeline │  │Strategy │  │ Platform Adapters  │
              │ Crawl→Analyze  │  │ Pattern │  │ Meta │ Google │    │
              │ →Score→Report  │  │CPA,ROAS │  │ Slack│ (Base) │    │
              └────────────────┘  │CTR,Freq │  └───────────────────┘
                                  │Budget   │
                                  └─────────┘
┌──────────────────────────────────────────────────────────────────────────┐
│                     BACKGROUND JOBS (Bull + Redis)                        │
│  seoAudit │ keywordSync │ ruleEvaluation │ analyticsRefresh │            │
│  integrationSync │ tokenHealthCheck │ notifications                      │
└──────────────────────────────────────────────────────────────────────────┘
       │                          │
┌──────▼──────────┐    ┌─────────▼─────────┐
│  PostgreSQL 16  │    │     Redis 7       │
│  (Prisma ORM)   │    │  Queues + Cache   │
└─────────────────┘    └───────────────────┘
```

---

## Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Runtime** | Node.js 23 | Server runtime |
| **Framework** | Express 4.18 | REST API server |
| **ORM** | Prisma 6.19 | Type-safe database access |
| **Database** | PostgreSQL 16 Alpine | Primary data store |
| **Cache/Queue** | Redis 7 Alpine + Bull | Job queues, caching, sessions |
| **Frontend** | React 18 + Vite | SPA dashboard |
| **Styling** | Tailwind CSS 3 | Utility-first CSS |
| **Auth** | JWT + bcrypt | Stateless authentication |
| **Validation** | Zod + Joi | Request schema validation |
| **SEO Crawling** | Cheerio | HTML parsing and analysis |
| **Security** | Helmet + XSS + Rate Limiting | API hardening |
| **Logging** | Pino + Winston | Structured JSON logging |
| **Email** | Resend | Transactional email |
| **Monitoring** | Sentry | Error tracking |
| **Testing** | Jest + Supertest | Unit and integration tests |
| **Containers** | Docker Compose | Local development |

---

## Project Structure

```
Adpilot/
├── index.html                    # Landing page (dark theme)
├── login.html                    # Auth page
├── docker-compose.yml            # PostgreSQL 16 + Redis 7
├── package.json                  # Backend dependencies
├── nodemon.json                  # Dev server config
├── seed.js                       # Database seed runner
│
├── prisma/
│   ├── schema.prisma             # 15+ models (Team, User, Campaign, Ad, Rule...)
│   └── migrations/               # 3 migrations (init, phase3, integrations)
│
├── client/                       # React 18 + Vite + Tailwind
│   ├── src/
│   │   ├── App.jsx               # Router + auth guard
│   │   ├── main.jsx              # Entry point
│   │   ├── lib/api.js            # Axios instance + interceptors
│   │   ├── store/authStore.js    # Zustand auth state
│   │   ├── components/
│   │   │   ├── layout/           # AppLayout, Sidebar, TopBar
│   │   │   ├── ui/               # Badge, StatCard
│   │   │   └── campaigns/        # CreateCampaignModal
│   │   └── pages/                # 10 pages (Dashboard, Campaigns, SEO, etc.)
│   └── dist/                     # Production build output
│
└── src/                          # Backend (Express)
    ├── server.js                 # HTTP server bootstrap
    ├── app.js                    # Express app + route mounting
    │
    ├── config/                   # Centralized configuration
    │   ├── prisma.js             #   Prisma client singleton
    │   ├── redis.js              #   ioredis connection
    │   ├── seo.js                #   Audit weights & thresholds
    │   ├── logger.js             #   Pino + Winston
    │   ├── sentry.js             #   Error tracking
    │   ├── limits.js             #   Plan-based feature limits
    │   └── featureFlags.js       #   Feature flag system
    │
    ├── middleware/                # Express middleware stack
    │   ├── auth.js               #   JWT verification
    │   ├── errorHandler.js       #   Global error handler + Sentry
    │   ├── rateLimiter.js        #   Rate limiting
    │   ├── sanitize.js           #   XSS input sanitization
    │   └── correlationId.js      #   Request tracing (X-Request-ID)
    │
    ├── routes/                   # 8 route modules
    ├── controllers/              # 7 controllers
    │
    ├── services/
    │   ├── authService.js        # Register, login, JWT tokens
    │   ├── campaignService.js    # Campaign CRUD + platform sync
    │   ├── adService.js          # Ad creative management
    │   │
    │   ├── seo/                  # ★ SEO Intelligence Engine
    │   │   ├── SeoAuditService.js
    │   │   ├── KeywordTrackingService.js
    │   │   ├── CompetitorGapService.js
    │   │   ├── ContentBriefService.js
    │   │   └── audit/            # ★ 4-Stage Audit Pipeline
    │   │       ├── AuditOrchestrator.js      # Orchestrator
    │   │       ├── adapters/                 # Crawler adapters
    │   │       │   ├── BaseCrawlerAdapter.js
    │   │       │   └── PuppeteerAdapter.js
    │   │       ├── engines/                  # Processing engines
    │   │       │   ├── CrawlEngine.js
    │   │       │   ├── TechnicalAnalyzer.js
    │   │       │   ├── PerformanceEngine.js
    │   │       │   └── ScoringEngine.js
    │   │       └── rules/                    # 16 audit rules
    │   │           ├── BaseRule.js
    │   │           ├── registry.js
    │   │           ├── technical/ (9 rules)
    │   │           ├── content/  (4 rules)
    │   │           └── structure/ (3 rules)
    │   │
    │   ├── analytics/            # Analytics pipeline
    │   │   ├── AnalyticsAggregator.js
    │   │   ├── AnomalyDetector.js
    │   │   └── MetricsCalculator.js
    │   │
    │   ├── rules/                # ★ Automation Rule Engine
    │   │   ├── RuleEngine.js
    │   │   └── strategies/       # 5 strategies (ROAS, CPA, CTR, Freq, Budget)
    │   │
    │   ├── integrations/         # ★ Platform Adapters
    │   │   ├── IntegrationService.js
    │   │   ├── TokenEncryptionService.js
    │   │   └── adapters/         # Meta, Google, Slack
    │   │
    │   ├── notifications/        # NotificationService
    │   ├── email/                # EmailService (Resend)
    │   └── team/                 # TeamService + InviteService
    │
    ├── repositories/             # Data access layer (BaseRepository pattern)
    ├── queues/                   # 7 Bull job processors
    ├── validators/               # Zod/Joi request schemas
    └── common/                   # AppError, response helpers, pagination
```

---

## SEO Audit Engine

The SEO engine is a 4-stage pipeline built entirely with free, self-hosted tools — zero API costs.

### Pipeline

```
User triggers audit
        │
        ▼
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐     ┌──────────────┐
│   CrawlEngine   │ ──▶ │TechnicalAnalyzer │ ──▶ │ ScoringEngine  │ ──▶ │    Report     │
│                 │     │                  │     │                │     │              │
│ Breadth-first   │     │ 16 rules         │     │ Weighted 0-100 │     │ JSON + AI    │
│ Up to 500 pages │     │ 3 categories     │     │ Per-category   │     │ summary      │
│ Status codes    │     │ Isolated exec    │     │ Overall score  │     │              │
└─────────────────┘     └──────────────────┘     └────────────────┘     └──────────────┘
        │
        ▼
┌─────────────────┐
│PerformanceEngine│
│ Lighthouse CI   │
│ Core Web Vitals │
└─────────────────┘
```

### 16 Audit Rules

| Category | Rule | Severity | What It Checks |
|----------|------|----------|----------------|
| **Technical** | TitleRule | Critical | Missing/duplicate/too-long title tags |
| | MetaDescriptionRule | High | Missing or poorly sized meta descriptions |
| | HeadingRule | Medium | H1 count, heading hierarchy |
| | HttpsRule | Critical | SSL certificate, HTTP→HTTPS redirects |
| | CanonicalRule | High | Missing or self-referencing canonicals |
| | RobotsTxtRule | Medium | robots.txt existence and validity |
| | SitemapRule | Medium | XML sitemap existence and format |
| | BrokenLinksRule | Critical | 404s, 5xx, dead internal links |
| | RedirectChainRule | High | Chains > 2 hops, redirect loops |
| **Content** | WordCountRule | Medium | Thin content (< 300 words) |
| | ImageAltRule | Medium | Missing alt text on images |
| | DuplicateTitleRule | High | Identical titles across pages |
| | DuplicateMetaRule | High | Identical meta descriptions |
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
| `POST` | `/api/auth/register` | Create account + team | No |
| `POST` | `/api/auth/login` | Get JWT token | No |
| `GET` | `/api/campaigns` | List campaigns (paginated) | Yes |
| `POST` | `/api/campaigns` | Create campaign | Yes |
| `PATCH` | `/api/campaigns/:id` | Update campaign | Yes |
| `DELETE` | `/api/campaigns/:id` | Soft-delete campaign | Yes |
| `GET` | `/api/campaigns/:id/ads` | List ads for campaign | Yes |
| `POST` | `/api/campaigns/:id/ads` | Create ad creative | Yes |
| `POST` | `/api/seo/audit` | Trigger site audit | Yes |
| `GET` | `/api/seo/audit/:id` | Get audit results | Yes |
| `GET` | `/api/seo/keywords` | Tracked keywords | Yes |
| `GET` | `/api/analytics/overview` | Dashboard metrics | Yes |
| `GET` | `/api/rules` | List automation rules | Yes |
| `POST` | `/api/rules` | Create automation rule | Yes |
| `POST` | `/api/integrations/connect` | OAuth connect | Yes |
| `DELETE` | `/api/integrations/:id` | Disconnect platform | Yes |
| `GET` | `/api/teams/current` | Current team | Yes |
| `POST` | `/api/teams/invite` | Invite member | Yes |

---

## Background Jobs

| Queue | Schedule | Purpose |
|-------|----------|---------|
| `seoAudit` | On-demand | Full site crawl + analysis + scoring |
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

# Install dependencies
npm install
cd client && npm install && cd ..

# Start databases
docker compose up -d

# Setup environment
cp .env.example .env   # edit with your values

# Run migrations + seed
npx prisma migrate dev
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
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
RESEND_API_KEY="re_xxxx"
ALLOWED_ORIGINS="http://localhost:5173"
```

---

## Scripts

```bash
npm run dev            # Backend with hot reload
npm run start          # Production start
npm run seed           # Seed database
npm run test           # Run tests
npx prisma studio      # Database GUI
npx prisma migrate dev # Run migrations
```

---

## Authors

Built with ☕ and Claude Code by **Vedang Vaidya** & **Aditya Tiwari**

---

<div align="center">

**[⬆ Back to Top](#-adpilot)**

</div>
