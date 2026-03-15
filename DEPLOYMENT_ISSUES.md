# AdPilot — Deployment Issues & Fixes

A living document. Every time a deployment breaks, add the root cause and fix here.

---

## The Golden Rules (learned the hard way)

1. **Only DB and HTTP are fatal.** Everything else (Redis, queues, cron, pulse) must warn and continue. Never `process.exit(1)` on an optional service.
2. **Every EventEmitter needs an `error` listener.** Bull queues, Redis clients, any stream — if it can emit `error`, add a listener or Node throws it as `uncaughtException`.
3. **Env vars from Railway are always strings.** Never use `Joi.boolean()` alone — use `Joi.alternatives().try(Joi.boolean(), Joi.string())`. Never use `Joi.string().uri()` without `.allow('')` for optional services.
4. **`localhost` doesn't work inside Docker.** DB and Redis use service hostnames (`postgres`, `redis`). Override in `docker-compose.yml` environment block, keep `.env` for local dev.
5. **Railway caches aggressively.** If changes don't show up, update the `CACHE_BUST` comment in Dockerfile above the `FROM node:20-slim AS production` line.
6. **The startup banner must always print.** `server.js` logs http/db/queues/cron/pulse status on every boot — check Railway/VPS deploy logs for this banner to instantly know what's healthy.

---

## Issue #1 — Docker: App can't reach Postgres/Redis (localhost inside container)

**Symptom:**
```
Database not ready yet (attempt N): Can't reach database server at `localhost:5432`
```
App container loops retrying DB connection and never starts.

**Root cause:**
`.env` has `DATABASE_URL=postgresql://...@localhost:...`. Inside a Docker container, `localhost` refers to the container itself — not the host machine or sibling services.

**Fix:**
In `docker-compose.yml`, override the URLs in the `environment:` block using Docker service names:
```yaml
adpilot-app:
  env_file: .env
  environment:
    DATABASE_URL: postgresql://postgres:postgres@postgres:5432/adpilot
    REDIS_URL: redis://redis:6379
```
This lets `.env` keep `localhost` URLs (for local `npm run dev`) while Docker uses service hostnames.

**Rule:** Never rely on `.env` for DB/Redis URLs inside Docker. Always override in `docker-compose.yml`.

---

## Issue #5 — Railway: Bull queue Redis error → uncaughtException → crash

**Symptom:**
```
Database ready after 1 attempt(s)
Sentry DSN not set — error reporting disabled
EmailService: RESEND_API_KEY not set — emails will be logged only
Uncaught exception    ← app restarts in a loop, healthcheck never passes
```

**Root cause:**
`src/queues/index.js` creates all Bull queues at module load time (top-level `const queues = {...}`). When Redis is unreachable or the connection fails, Bull emits an `'error'` event. Node.js requires at least one `'error'` listener on every EventEmitter — without one, it converts the event to a thrown exception, which becomes an `uncaughtException` and crashes the process.

**Fix (applied `954a14c3`):**
Add an `'error'` listener to every Bull queue in `createQueue()`:
```js
queue.on('error', (err) => {
  logger.error(`Queue [${name}] Redis error`, { error: err.message });
});
```
The app now logs the Redis error and keeps running. Background jobs degrade gracefully; the core API and healthcheck stay up.

**Rule:** Every Bull queue MUST have an `'error'` listener. Never create a Bull queue without one. Add it immediately after `new Bull(...)`.

---

## Issue #6 — Railway: Docker build fully cached, code changes not picked up

**Symptom:**
All Dockerfile steps show `cached` in Railway build logs — including `COPY src ./src/`. New code changes never reach the running container.

**Root cause:**
Railway uses BuildKit inline cache. Sometimes its cache layer invalidation doesn't trigger even when source files change (timing or cache key issue).

**Fix:**
Add or update a comment in the Dockerfile stage that's before `COPY src`:
```dockerfile
# CACHE_BUST: 2026-03-15 — reason for bust
FROM node:20-slim AS production
```
Changing any line before a `COPY` step invalidates all subsequent layers.

**Rule:** If Railway deploys show all steps as cached after a code change, update the `CACHE_BUST` comment date in the Dockerfile.

---

## Issue #2 — Railway: App crashes on startup ("Uncaught exception") after DB connects

**Symptom:**
```
Database ready after 1 attempt(s)
Sentry DSN not set — error reporting disabled
EmailService: RESEND_API_KEY not set — emails will be logged only
Uncaught exception
```
Railway healthcheck fails. Build succeeds. Container restarts in a loop.

**Root cause:**
`src/config/env.js` Joi validation throws on startup if:
1. A newly added `Joi.string().uri()` field (e.g. `OLLAMA_URL`) is set to `""` (empty string) in Railway env — URI validator rejects empty strings without `.allow('')`
2. A `Joi.boolean()` field (e.g. `SEO_ENGINE_V2`) receives string `"true"` from Railway — Railway always injects env vars as strings

**Fix:**
- Add `.optional().allow('')` to all URI validators for optional services:
  ```js
  OLLAMA_URL: Joi.string().optional().allow('').default('http://localhost:11434'),
  ```
- Use `Joi.alternatives()` for boolean flags that Railway sends as strings:
  ```js
  SEO_ENGINE_V2: Joi.alternatives().try(Joi.boolean(), Joi.string().allow('')).default(false),
  ```

**Rule:** Every time you add a new env var to `env.js`:
- Optional services: always add `.optional().allow('')`
- Boolean feature flags: use `Joi.alternatives()` not `Joi.boolean()` alone
- URI fields for optional services: add `.optional().allow('')` before `.default()`

---

## Issue #3 — Railway healthcheck path mismatch

**Symptom:**
Railway shows "Attempt #N failed with service unavailable" during healthcheck, even though the app appears to start.

**Root cause:**
Railway's healthcheck is configured to hit `/health`. If the app registers its health route at a different path (e.g. `/api/v1/health`), healthchecks will always fail.

**Current state:** ✅ OK — `src/app.js` mounts `healthRoutes` at `/health`. Railway checks `/health`.

**Rule:** Never move or rename the `/health` route. Railway's healthcheck path is set in the Railway dashboard and cannot be changed per-deploy.

---

## Issue #4 — Duplicate Dockerfile (src/Dockerfile)

**Symptom:**
`src/Dockerfile` existed as a stale copy of the root `Dockerfile`, causing confusion about which one Docker uses.

**Fix:** Deleted `src/Dockerfile`. Only the root `Dockerfile` is used by `docker-compose.yml` and Railway.

**Rule:** One Dockerfile at the repo root. Never duplicate it.

---

## Deployment Checklist (run before every push)

### Local Docker
- [ ] `docker compose ps` — all 3 containers healthy
- [ ] `curl http://localhost:3001/api/v1/health` — responds (even 401 = OK, app is running)
- [ ] `docker logs adpilot-app --tail 20` — no crash loops

### Railway
- [ ] After push, watch Railway build logs — build must complete without error
- [ ] Deploy logs must show: "Server started ✓", "Database connected ✓", "Queue processors registered ✓"
- [ ] Healthcheck at `/health` must pass within 60s
- [ ] Check Railway env vars include: `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`

### VPS (Contabo — 194.163.146.140)
```bash
ssh root@194.163.146.140
cd /path/to/adpilot
git pull origin main
docker compose down adpilot-app
docker compose up -d --build adpilot-app
docker logs adpilot-app --tail 30
curl http://localhost:3001/api/v1/health
```

---

## Environment Variables — What's Required Where

| Variable | Local `.env` | Railway | VPS `.env` | Notes |
|----------|-------------|---------|------------|-------|
| `DATABASE_URL` | `localhost` URL | Auto-injected by Railway Postgres plugin | `postgres` service name | See Issue #1 |
| `REDIS_URL` | `localhost` URL | Auto-injected by Railway Redis plugin | `redis` service name | See Issue #1 |
| `JWT_SECRET` | dev value | **Must set manually** | **Must set manually** | Min 32 chars |
| `JWT_REFRESH_SECRET` | dev value | **Must set manually** | **Must set manually** | Min 32 chars |
| `ENCRYPTION_KEY` | 64 zeros (dev) | **Must set manually** | **Must set manually** | 64 hex chars |
| `ALLOWED_ORIGINS` | `http://localhost:5173` | Your Vercel/frontend URL | Frontend URL | CORS |
| `OLLAMA_URL` | `http://localhost:11434` | Leave blank (no Ollama on Railway) | Optional | Optional |
| `SEO_ENGINE_V2` | `true` | `true` (string OK) | `true` | See Issue #2 |

Generate secrets with:
```bash
openssl rand -hex 64   # JWT_SECRET / JWT_REFRESH_SECRET
openssl rand -hex 32   # ENCRYPTION_KEY (produces 64 hex chars)
```
