# AdPilot Deployment Problems Log

> Rule: Never close a problem until the app successfully starts AND the health check passes in Railway.
> Every fix attempt gets an entry BEFORE writing code.

---

## Problem #1 — Railway healthcheck failure (ongoing)

**Date:** 2026-03-15
**Iteration count:** 6
**Status:** 🔴 OPEN — awaiting Railway healthcheck confirmation after latest push

---

### What the symptom looks like

Railway deploy logs show the container starting, then crashing in a loop:

```
Starting Container
Database ready after 1 attempt(s)
Sentry DSN not set — error reporting disabled
EmailService: RESEND_API_KEY not set — emails will be logged only
Uncaught exception
```

Health check path: `/health`, retry window: 1 minute.
The container never responds to `/health` — it crashes before the HTTP server binds.

---

### Root cause (confirmed 2026-03-15 iteration 6)

`TrafficSignalAdapter.js` line 3:
```js
const env = require('../../../config/env');
```

`config/env.js` runs Joi schema validation against `process.env` at require-time and **throws** if any required var fails. In Railway, `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `ENCRYPTION_KEY` were either unset or too short.

Full error from Railway logs:
```
[FATAL] Uncaught exception: Environment validation failed:
  "JWT_SECRET" length must be at least 32 characters long
  "JWT_REFRESH_SECRET" length must be at least 32 characters long
  "ENCRYPTION_KEY" length must be 64 characters long
    at Object.<anonymous> (/app/src/config/env.js:74:9)
    at Object.<anonymous> (/app/src/services/research/adapters/TrafficSignalAdapter.js:3:13)
```

This was invisible in earlier iterations because the `uncaughtException` handler only logged to pino JSON — Railway's log viewer collapsed it. The raw `process.stderr.write` added in iteration 6 revealed it.

---

### What was tried (all iterations)

| Iter | Date | Hypothesis | Action | Outcome |
|------|------|-----------|--------|---------|
| 1 | 2026-03-15 | Redis unavailable crashes queues | Added `queue.on('error', ...)` handler to all 8 Bull queues | Did not fix — Redis was online, wrong root cause |
| 2 | 2026-03-15 | Server startup order wrong | Refactored server.js to start HTTP first, then DB, then queues (non-fatal) | Did not fix — correct architecture but wrong root cause |
| 3 | 2026-03-15 | Redis not provisioned in Railway | Documented need for Railway Redis service | Redis was already online — wrong root cause |
| 4 | 2026-03-15 | Docker layer cache preventing new code reaching Railway | Added `RUN echo "src-cache-bust-..."` to Dockerfile before `COPY src` | Cache busting worked, but root cause still hidden |
| 5 | 2026-03-15 | CORS IP wrong (149 vs 140) | Fixed CORS origin IP | Not the crash cause — separate CORS issue fixed |
| 6 | 2026-03-15 | Error details hidden in pino JSON fields | Added `process.stderr.write(err.message + stack)` to uncaughtException handler; removed duplicate handler in server.js | **Revealed the actual error** — env.js throws on startup due to short JWT_SECRET |
| 6b | 2026-03-15 | TrafficSignalAdapter.js eagerly loads env.js | Replaced `require('../../../config/env')` with inline `process.env` getters for only CLOUDFLARE/SIMILARWEB keys | **Fix pushed** — commit `051dfa4a` |

---

### What still needs to happen

- [ ] Railway Variables must be set (JWT_SECRET ≥ 32 chars, JWT_REFRESH_SECRET ≥ 32 chars, ENCRYPTION_KEY = 64 hex chars)
- [ ] Railway deploy of commit `051dfa4a` must complete successfully
- [ ] `/health` must return HTTP 200 in Railway healthcheck window

**Suggested Railway Variable values (freshly generated):**
```
JWT_SECRET=8df76ac88d20a782dc102d6dcf97019d73f4318a23db41c787fe57921d23f810
JWT_REFRESH_SECRET=e0d59c30ba4d4fc7a7f350e1d6793338f394c29b525138e8149c44f8b0505429
ENCRYPTION_KEY=bc18c1f9ace6d7fb38a12256eb44f8480efd2bb88b1563f7195973e654fcfd06
```

---

### Lesson learned

`config/env.js` is a **startup bomb** — it throws synchronously at `require()` time if any validated var fails. It must **never** be required from any module that is loaded eagerly at app startup (routes, controllers, services loaded at the top of app.js). It is safe to require only inside request handlers (lazy load). Added this as a code rule.
