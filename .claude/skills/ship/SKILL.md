---
name: ship
description: Ship current work — runs security audit, tests, lints, reviews, commits, pushes, and updates docs. Use whenever committing code, pushing to GitHub, or finishing a task. This is the ONLY way code should leave the local machine.
---

# Ship Command — Audit → Test → Review → Commit → Push

You MUST complete every step in order. If any step fails, STOP and fix before continuing.

## Step 1: Security Audit (MANDATORY — never skip)

```bash
cd /Users/adityatiwari/Desktop/Development/Adpilot

# Run npm audit on backend — warn on high/critical
npm audit --audit-level=high 2>&1
AUDIT_EXIT=$?
if [ $AUDIT_EXIT -ne 0 ]; then
  echo "⚠️  HIGH or CRITICAL vulnerabilities found in backend dependencies."
  echo "    Run: npm audit fix"
  echo "    Review unfixable issues before proceeding."
fi

# Run npm audit on frontend
cd client && npm audit --audit-level=high 2>&1
CLIENT_AUDIT_EXIT=$?
if [ $CLIENT_AUDIT_EXIT -ne 0 ]; then
  echo "⚠️  HIGH or CRITICAL vulnerabilities found in frontend dependencies."
  echo "    Run: npm audit fix"
fi
cd ..
```

**If high/critical vulnerabilities exist:**
1. Run `npm audit fix` to auto-patch safe upgrades
2. For unfixable issues, note them in the commit message
3. NEVER ship with a critical vulnerability without explicit user sign-off

## Step 2: Run Tests

### Backend Tests
```bash
cd /Users/adityatiwari/Desktop/Development/Adpilot

# Run Jest tests if they exist
if [ -f jest.config.js ] || grep -q '"test"' package.json 2>/dev/null; then
  npm test 2>&1 | tail -20
fi

# Verify server starts and health endpoint responds
node -e "
const http = require('http');
const req = http.get('http://localhost:3000/health', (res) => {
  if (res.statusCode === 200) { console.log('✅ Backend health check passed'); process.exit(0); }
  else { console.error('❌ Backend health check failed:', res.statusCode); process.exit(1); }
});
req.on('error', () => { console.log('⚠️  Backend not running — skipping health check'); process.exit(0); });
req.setTimeout(3000, () => { console.log('⚠️  Backend timeout — skipping health check'); process.exit(0); });
"
```

### Frontend Build Check
```bash
cd /Users/adityatiwari/Desktop/Development/Adpilot/client

# Build check catches import errors, missing deps, broken JSX
npm run build 2>&1 | tail -15
if [ $? -ne 0 ]; then
  echo "❌ Frontend build FAILED — FIX BEFORE SHIPPING"
  exit 1
fi
echo "✅ Frontend build passed"
```

## Step 3: Quick Code Review (30 seconds)

Before committing, check for:
- [ ] No `console.log` in production code — use `logger` from `src/config/logger.js`
- [ ] No hardcoded API keys, secrets, or passwords
- [ ] No `.env` files staged accidentally
- [ ] All new routes have `try/catch` and proper error handling
- [ ] All new endpoints have input validation (Zod/Joi)
- [ ] API responses follow `{ success, data, error, meta }` format
- [ ] `.env.example` updated if new env vars were added

If issues found, fix them before proceeding.

## Step 4: Git Stage

```bash
cd /Users/adityatiwari/Desktop/Development/Adpilot
git status
git add <specific files>  # never use git add . blindly
```

Review what's staged. If `.env`, logs, or temp files appear, add them to `.gitignore` first.

## Step 5: Commit

Follow conventional commits:
```
feat: <what was added>
fix: <what was fixed>
chore: <maintenance/config/docs>
refactor: <what was restructured>
test: <what tests were added>
security: <security hardening>
```

Example:
```bash
git commit -m "security: add rate limiting, XSS sanitization, helmet, dependabot

- apiLimiter: 100 req/15min per IP (was 120/min)
- authLimiter: 5 attempts/15min per IP — now applied to all auth routes
- campaignStartLimiter: 10 launches/hour per user
- sanitize middleware: xss-cleans all req.body and req.query
- helmet: security headers on all responses
- dependabot.yml: weekly npm + GitHub Actions updates"
```

## Step 6: Push

```bash
git push origin main
```

If rejected:
```bash
git pull --rebase origin main
git push origin main
```

## Step 7: Verify Deployment

After pushing, GitHub Actions will deploy to Contabo VPS. Verify:
```bash
# Check Actions status
gh run list --limit 3

# After deploy completes, hit health endpoint
curl -s http://194.163.146.140:3001/health | jq .
```

PM2 log check if needed:
```bash
# Via SSH
ssh root@194.163.146.140 "pm2 logs adpilot --lines 20 --nostream"
```

## Step 8: Report

Print a summary:
```
✅ SHIPPED
- Security audit: clean (or: N high vulns noted)
- Tests: X passed, 0 failed
- Build: clean
- Commit: <hash>
- Pushed to: github.com/Aadi262/Adpilot
- Deploy: GitHub Actions → Contabo VPS (PM2: adpilot)
```
