# Coding Conventions

**Analysis Date:** 2026-03-15

## Naming Patterns

**Files:**
- Backend services: camelCase + `Service` suffix
  - Example: `src/services/authService.js`, `src/services/adService.js`, `src/services/campaignService.js`
- Controllers: camelCase + `Controller` suffix
  - Example: `src/controllers/authController.js`, `src/controllers/campaignController.js`
- Repositories: camelCase + `Repository` suffix
  - Example: `src/repositories/campaignRepository.js`, `src/repositories/userRepository.js`
- Routes: camelCase + `Routes` suffix
  - Example: `src/routes/authRoutes.js`, `src/routes/campaignRoutes.js`
- Validators: camelCase + `Validator` suffix or `Schema` suffix
  - Example: `src/validators/authValidator.js`, `src/validators/schemas/campaignSchema.js`
- Middleware: camelCase, descriptive name
  - Example: `src/middleware/errorHandler.js`, `src/middleware/rateLimiter.js`
- React components: PascalCase
  - Example: `client/src/pages/DashboardPage.jsx`, `client/src/components/CreateCampaignModal.jsx`
- React hooks: (not custom hooks present; using existing React hooks and Zustand stores)
- Stores (Zustand): camelCase + "Store"
  - Example: `client/src/store/authStore.js`

**Functions:**
- Regular functions: camelCase
  - Example: `findById()`, `generateAdWithAI()`, `validateRequest()`
- Factory methods (static class methods): camelCase with descriptive action
  - Example: `AppError.badRequest()`, `AppError.notFound()`, `AppError.conflict()`
- Private/internal methods: prefixed with underscore + camelCase
  - Example: `_normalizeDomain()`, `_computeScore()`

**Variables:**
- Local variables and parameters: camelCase
  - Example: `campaignId`, `teamId`, `userData`, `responseData`
- Constants: UPPER_SNAKE_CASE (in config/constants, or at module top level)
  - Example: `PLATFORMS`, `OBJECTIVES`, `TIMEOUT_MS`, `PRIORITY_STYLES`
- Database column names: snake_case (Prisma maps to camelCase in code)
  - Example: DB `team_id` → JS `teamId`, DB `created_at` → JS `createdAt`

**Types:**
- Zod schemas: camelCase + `Schema` suffix
  - Example: `createCampaignSchema`, `loginSchema`, `updateCampaignSchema`
- Error classes: PascalCase, named `AppError` or suffixed with `Error`
  - Example: `AppError`, `ValidationError`

## Code Style

**Formatting:**
- No Prettier or ESLint config detected
- Observed conventions:
  - 2-space indentation (consistent throughout)
  - Single quotes for strings (in JS files)
  - Semicolons used consistently
  - Max line length: observed ~100-120 chars (not strictly enforced)
  - Comment lines use full-width ASCII dividers for section headers
    - Example: `// ── Async testing ────────────────────────────────`

**Linting:**
- No linter configured (no .eslintrc, .eslintignore)
- Comments suggest intent: `// eslint-disable-next-line no-unused-vars`

**Imports/Requires:**
- Backend (Node.js): CommonJS `require()` syntax
  - `const module = require('path');`
  - Sentry must be initialized FIRST before other requires (see `src/app.js` line 3-4)
- Frontend (React): ES6 `import` syntax
  - `import { useState } from 'react';`
- Grouping observed in backend:
  1. `'use strict';` directive (always first)
  2. Core Node modules (path, express, etc)
  3. Third-party packages (helmet, cors, jwt)
  4. Local config modules
  5. Services/middleware
  6. Route handlers

**Path Aliases:**
- Frontend: None detected (standard relative paths used)
- Backend: No path aliases; relative imports throughout

## Error Handling

**Patterns:**
- Centralized `AppError` class in `src/common/AppError.js`
- Static factory methods for common HTTP status codes:
  - `AppError.badRequest(message, code)` → 400
  - `AppError.unauthorized(message)` → 401
  - `AppError.forbidden(message)` → 403
  - `AppError.notFound(resource)` → 404
  - `AppError.conflict(message)` → 409
  - `AppError.unprocessable(message)` → 422
  - `AppError.tooManyRequests(message)` → 429
  - `AppError.serviceUnavailable(message)` → 503
  - `AppError.internal(message)` → 500

**Error Flow:**
1. Errors thrown in services → caught in controller
2. Controllers pass to `next(error)` in Express
3. Global `errorHandler` middleware (`src/middleware/errorHandler.js`) normalizes:
   - Prisma errors (P2002 → 409, P2025 → 404, P2003 → 400)
   - Network/AI provider errors → 503 (service unavailable)
   - Unexpected errors → logged + sent to Sentry
4. Response envelope: `{ success: boolean, data: any, error: { message, code }, meta: { timestamp } }`

**Operational vs Unexpected:**
- `AppError` instances: marked `isOperational = true` (expected client errors)
- Other errors: logged fully + Sentry captured (unexpected bugs)
- 4xx errors not sent to Sentry (noise)
- 5xx or non-operational errors sent to Sentry with context

## Logging

**Framework:** Pino (under the hood), Winston-compatible API layer
- `src/config/logger.js` provides wrapper: `logger.info(message, { meta })`
- Auto-injects context from AsyncLocalStorage (ALS): `{ traceId, teamId, jobId, provider }`
- Levels: `debug` (dev), `info`, `warn`, `error`
- Output:
  - Development: colorized via pino-pretty
  - Production: compact JSON, one-line-per-log

**When to Log:**
- Incoming requests: log method, URL, IP (in app.js middleware)
- Slow requests (>3000ms): warn level
- Auth failures: not explicitly logged (auth middleware)
- Unhandled errors: error level with full stack + context
- Business logic milestones: info level (ad generated, campaign launched, etc.)

**Example:**
```javascript
logger.info('Campaign created', { campaignId: '123', teamId: 'abc' });
logger.error('Database timeout', { query: 'findCampaigns', ms: 5000 });
```

## Comments

**When to Comment:**
- Section dividers: full-width ASCII headers for logical blocks
  - Used in `src/app.js`, route files, page components
- Inline: explain "why" not "what" (code is readable; explain decisions)
- Example (from `src/middleware/auth.js`): `// Stamp teamId onto the current ALS store...`

**JSDoc/TSDoc:**
- Limited use; mostly in base classes and complex functions
- Example in `src/repositories/base/BaseRepository.js`:
  ```javascript
  /**
   * BaseRepository — generic Prisma CRUD with soft-delete, pagination, and team-scoping.
   * Extend and override per-model:
   *   class CampaignRepository extends BaseRepository {
   *     constructor() { super('campaign'); }
   *   }
   */
  ```

## Function Design

**Size:**
- Small, single-responsibility functions preferred
- Repository methods: 1-20 lines (simple queries)
- Service methods: 10-50 lines (business logic)
- Controllers: 10-30 lines (request → service → response)
- Large functions (100+ lines) exist for complex AI workflows; these use helper sub-functions

**Parameters:**
- Named parameters preferred in services: `async findMany({ where = {}, orderBy = {}, skip = 0, take = 20 } = {})`
- Positional for simple CRUD: `async findById(id)`, `async findById(id, teamId)`
- Avoid excessive boolean flags; use objects for options

**Return Values:**
- Services: return plain objects (Prisma models, calculated results)
- Controllers: return nothing (use response helpers: `success()`, `created()`, `failure()`)
- Repositories: return Prisma results or null
- Observable pattern in some AI services: fallback chains (Gemini → Groq → Anthropic → mock)

## Module Design

**Exports:**
- Repositories: export named functions
  - Example: `module.exports = { findAll, findById, create, update, delete };`
- Services: export named functions
  - Example: `module.exports = { registerUser, loginUser, ... };`
- Controllers: export named functions
  - Example: `module.exports = { register, login, ... };`
- Middleware: export function or object with methods
  - Example: `module.exports = { authenticate, requireRole };`
- Config modules: export object or function
  - Example: `module.exports = { jwt: { ... }, database: { ... } };`

**Barrel Files:**
- Not used extensively
- Queues initialized in `src/queues/index.js` and exported as singleton

**Class Pattern:**
- Used in:
  - `BaseRepository` and subclasses (single inheritance)
  - Error handling: `AppError extends Error`
  - Adapter pattern: `BaseAdapter` with subclasses (Meta, Google, etc.)
- Most modules are functional (exported functions), not classes

## Backend MVC Structure

**Route Layer** (`src/routes/*.js`):
- Express router setup
- Middleware binding: `authenticate`, `requireRole`, `validateZod`
- Route → controller mapping

**Controller Layer** (`src/controllers/*.js`):
- Extracts request data
- Calls service layer
- Returns `success()`, `created()`, or passes error to `next()`
- Keeps validation in middleware, not in controller

**Service Layer** (`src/services/*.js`):
- Business logic
- Calls repositories and external APIs
- Throws `AppError` for expected errors
- No HTTP awareness

**Repository Layer** (`src/repositories/*.js`):
- Prisma query builders
- Basic CRUD operations
- Query logic only (no filtering beyond `teamId` for safety)

## Frontend Architecture

**State Management:**
- Auth state: Zustand (`useAuthStore`)
- Server state: React Query (`useQuery`, `useMutation`)
- UI state: React `useState` (local component state)
- Persisted auth: Zustand with `persist` middleware

**Component Structure:**
- Pages: top-level route components, import utilities and sub-components
- Components: split into `ui/` (reusable) and domain-specific folders
- Utilities: `src/lib/api.js` (Axios wrapper), `lib/exportCsv.js`, etc.
- API interceptors: attach auth token on every request, handle 401 logout

**Fetch Pattern:**
- Axios via `api` wrapper (`client/src/lib/api.js`)
- Pagination response normalization: `{ items: [...], pagination: {...} }`
- Error handling: 5xx errors emit custom `api:server-error` event for toast notifications

---

*Convention analysis: 2026-03-15*
