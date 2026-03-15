# Testing Patterns

**Analysis Date:** 2026-03-15

## Test Framework

**Status:** Not Yet Implemented

**Runner:**
- Jest v29.0.0 installed in `package.json` (devDependencies)
- Supertest v6.0.0 installed for HTTP testing
- No jest.config.js found — default Jest config in use

**Run Commands:**
```bash
npm test              # Run Jest tests (currently no tests exist)
```

**Assertion Library:**
- Jest built-in assertions (not yet utilized)

## Test File Organization

**Current State:**
- No test files exist in `src/` or `client/src/`
- Node modules contain third-party tests but not project tests
- Test structure not yet established

**Recommended Structure:**
- Co-located (alongside source files):
  - `src/services/authService.js` → `src/services/authService.test.js`
  - `src/controllers/campaignController.js` → `src/controllers/campaignController.test.js`
- Directories:
  - `src/__tests__/` (if preferred centralized)
  - `client/src/__tests__/` (frontend tests)

**Naming:**
- `.test.js` suffix (Jest convention)
- Pattern: `moduleName.test.js`

## Test Structure

**No tests currently exist** — the following represents patterns used elsewhere in dependencies and recommended approach based on Jest + Supertest stack.

**Observed Test Patterns (from dependencies):**
```typescript
// Example from installed Zod tests
describe('module', () => {
  it('should do something', () => {
    expect(value).toBe(expected);
  });

  it('handles error cases', () => {
    expect(() => { /* code */ }).toThrow();
  });
});
```

**Recommended Backend Pattern (Express + Supertest):**
```javascript
const request = require('supertest');
const app = require('../app');

describe('Authentication', () => {
  describe('POST /api/v1/auth/login', () => {
    it('should return 401 with invalid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'user@test.com', password: 'wrong' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should return token and user on valid login', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@adpilot.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.token).toBeDefined();
    });
  });
});
```

**Setup/Teardown Pattern:**
```javascript
beforeEach(async () => {
  // Reset database, seed test data
  // Clear caches
});

afterEach(async () => {
  // Clean up test data
  // Close connections if needed
});

afterAll(async () => {
  // Disconnect from test database
  // Close server
});
```

## Mocking

**Framework:** Jest built-in mocks (no external mocking library configured)

**Mocking Pattern:**
```javascript
jest.mock('../config/prisma', () => ({
  campaign: {
    findMany: jest.fn(),
    create: jest.fn(),
  },
}));

jest.mock('../services/authService', () => ({
  login: jest.fn(),
}));
```

**What to Mock:**
- External APIs: Gemini, Anthropic, Groq, HuggingFace, Ollama (always mock in unit tests)
- Database queries: Prisma calls (unit tests only; integration tests use test DB)
- Third-party integrations: Meta, Google, Stripe, Slack
- Redis and Bull queues (or use in-memory for testing)

**What NOT to Mock:**
- Express middleware (`authenticate`, `errorHandler`) — test the actual flow
- Validators (Zod, Joi) — test that they work
- AppError class — test error factory methods
- Utility functions (pagination, retry logic) — test pure functions directly

## Fixtures and Factories

**Test Data:**
No factory pattern currently established. Recommended approach:

```javascript
// src/__tests__/factories/userFactory.js
function createUser(overrides = {}) {
  return {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    teamId: 'team-123',
    role: 'member',
    ...overrides,
  };
}

function createCampaign(overrides = {}) {
  return {
    id: 'campaign-123',
    teamId: 'team-123',
    name: 'Test Campaign',
    platform: 'meta',
    objective: 'conversions',
    status: 'active',
    ...overrides,
  };
}

module.exports = { createUser, createCampaign };
```

**Location:**
- Recommended: `src/__tests__/fixtures/` or `src/__tests__/factories/`
- Seed file reference: `src/scripts/seed.js` (not tests, but data setup)

**Test Database:**
- Current seed credentials available:
  - `admin@adpilot.com` / `password123`
  - `manager@adpilot.com` / `password123`
- Team: "AdPilot Demo" (slug: adpilot-demo, plan: pro)
- 5 campaigns, 10 ads, 3 keywords, 2 competitors pre-seeded

## Coverage

**Requirements:** Not enforced
- No coverage thresholds configured
- No coverage reports in CI pipeline

**View Coverage:**
```bash
npm test -- --coverage    # Generate coverage report (once tests exist)
```

**Gaps (High Priority):**
- No unit tests for critical services:
  - `src/services/authService.js` (auth is security-sensitive)
  - `src/services/adService.js` (AI prompt engineering)
  - `src/services/seo/audit/` (complex audit pipeline)
  - `src/services/rules/RuleEngine.js` (campaign rule evaluation)

- No integration tests for:
  - API endpoint flows (auth → campaign → ads → analytics)
  - Prisma interactions with actual database
  - Bull queue job processing
  - External API fallbacks (e.g., Gemini → Groq → Anthropic chain)

- No E2E tests (separate from unit/integration)

## Test Types

**Unit Tests:**
- Scope: Individual functions/methods in isolation
- Approach: Mock all dependencies (services, database, APIs)
- Example targets:
  - Repository methods: `campaignRepository.findById()`
  - Validators: `campaignSchema.parse()`
  - Utility functions: `calculateROAS()`, `normalizeKeyword()`
  - Service helpers: analytics calculations, scoring functions

**Integration Tests:**
- Scope: Multiple components interacting (service → repository → database)
- Approach: Use test database; mock external APIs only
- Example targets:
  - Full create-campaign flow: API → controller → service → repository → DB
  - Auth flow: register → login → token validation
  - Rule evaluation: trigger conditions → database update
  - SEO audit: orchestrator → crawl engine → scoring → storage

**E2E Tests:**
- Status: Not implemented
- Recommended framework: Playwright or Cypress (for frontend)
- Scope: Full user journeys in browser (not headless)
- Example scenarios:
  - User registration → create campaign → generate ads → view analytics
  - SEO audit: enter domain → crawl → view results
  - Budget protection: view alerts → apply fix

## Common Patterns

**Async Testing:**
```javascript
// Using async/await with Jest
it('should load campaigns', async () => {
  const data = await campaignService.findAll(teamId);
  expect(data).toHaveLength(5);
});

// Using done callback (old pattern, not recommended)
it('should load campaigns', (done) => {
  campaignService.findAll(teamId).then((data) => {
    expect(data).toHaveLength(5);
    done();
  });
});

// Using return Promise (works with Jest)
it('should load campaigns', () => {
  return campaignService.findAll(teamId).then((data) => {
    expect(data).toHaveLength(5);
  });
});
```

**Error Testing:**
```javascript
// Testing thrown AppError
it('should throw unauthorized on missing token', () => {
  expect(() => {
    auth.authenticate(req, res, next);
  }).toThrow(AppError);
});

// Testing async error
it('should reject with 404 on missing campaign', async () => {
  await expect(
    campaignService.findById('nonexistent', 'team-123')
  ).rejects.toThrow('Campaign not found');
});

// Testing error type
it('should throw AppError with 404 status', async () => {
  try {
    await campaignService.findById('nonexistent', 'team-123');
  } catch (err) {
    expect(err.statusCode).toBe(404);
    expect(err.isOperational).toBe(true);
  }
});
```

**HTTP Testing with Supertest:**
```javascript
it('should return 401 without auth token', async () => {
  const res = await request(app)
    .get('/api/v1/campaigns')
    .expect(401);

  expect(res.body.success).toBe(false);
});

it('should return campaigns for authenticated user', async () => {
  const res = await request(app)
    .get('/api/v1/campaigns')
    .set('Authorization', `Bearer ${validToken}`)
    .expect(200);

  expect(res.body.success).toBe(true);
  expect(Array.isArray(res.body.data)).toBe(true);
});
```

**Frontend Testing (React Testing Library):**
```javascript
// Not yet configured, but recommended for React components
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

it('should submit campaign form', async () => {
  const { getByLabelText, getByText } = render(<CreateCampaignModal />);

  const nameInput = getByLabelText('Campaign name');
  await userEvent.type(nameInput, 'New Campaign');
  fireEvent.click(getByText('Create'));

  expect(await screen.findByText('Campaign created')).toBeInTheDocument();
});
```

## CI/CD Integration

**Current Status:** No test runner in CI pipeline
- Package.json has `npm test` script defined
- No GitHub Actions, GitLab CI, or equivalent configured
- Recommended: Add pre-commit hook or CI job to run tests

**Future Setup:**
```bash
# Pre-commit hook (optional but recommended)
npm test -- --bail        # Stop on first failure

# CI job example
npm test -- --coverage --watchAll=false
```

## Test Environment

**Database:**
- Test database could use: Docker PostgreSQL (existing setup)
- Isolation: Each test should use transactions or seed/cleanup

**Redis (for Bull queues):**
- Mock with Jest or use test instance (existing Docker setup)

**Environment Variables:**
- Use `.env.test` or override via `process.env` in test setup
- Disable external API calls (mock Gemini, Anthropic, etc.)

---

*Testing analysis: 2026-03-15*

## Summary

The codebase has testing infrastructure (Jest, Supertest) installed but **zero tests written**. High-priority areas for test coverage:

1. **Authentication** (`authService`, `authController`, auth middleware)
2. **Campaign CRUD** (database interactions, team scoping)
3. **AI Services** (fallback chains, error handling)
4. **SEO Audit** (complex orchestration pipeline)
5. **Rule Engine** (trigger evaluation, cooldown logic)
6. **API Endpoints** (full HTTP flow, error responses)

Recommended start: Write unit tests for `AppError` factory methods and utility functions, then integration tests for auth/campaign flows using test database.
