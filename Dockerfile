# ─────────────────────────────────────────────────────────────────────────────
# AdPilot — Full-stack Dockerfile (backend API + React frontend)
#
# Stage 1: Build the React frontend
# Stage 2: Run Express server which serves both API and static React build
#
# In production (NODE_ENV=production):
#   - Express serves client/dist as static files
#   - All /api/* routes hit the backend
#   - Everything runs on a single port (Railway injects PORT)
# ─────────────────────────────────────────────────────────────────────────────

# ── Stage 1: Build frontend ───────────────────────────────────────────────────
FROM node:20-slim AS frontend-builder

WORKDIR /app/client

COPY client/package*.json ./
RUN npm ci

COPY client/ ./

# VITE_API_URL must be empty in production — Express serves /api from same origin
# so the frontend uses relative /api/v1 paths (no CORS, no separate domain needed)
RUN npm run build

# ── Stage 2: Production backend ───────────────────────────────────────────────
FROM node:20-slim AS production

# Chrome OS-level dependencies required by Puppeteer / Lighthouse
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libc6 \
    libcairo2 \
    libcups2 \
    libdbus-1-3 \
    libexpat1 \
    libfontconfig1 \
    libgbm1 \
    libgcc1 \
    libglib2.0-0 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libstdc++6 \
    libx11-6 \
    libx11-xcb1 \
    libxcb1 \
    libxcomposite1 \
    libxcursor1 \
    libxdamage1 \
    libxext6 \
    libxfixes3 \
    libxi6 \
    libxrandr2 \
    libxrender1 \
    libxss1 \
    libxtst6 \
    lsb-release \
    wget \
    xdg-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend manifests + prisma first (layer cache)
COPY package*.json ./
COPY prisma ./prisma/

# Install backend deps (no devDeps in production)
# prisma CLI is in dependencies so it is available for client generation
RUN npm ci --omit=dev

# Generate Prisma client (uses the CLI installed above)
RUN node_modules/.bin/prisma generate

# Cache-bust token — update this string to force Railway to re-copy src on next deploy
# Format: YYYY-MM-DD-vN  (increment N each time you need to bust cache)
RUN echo "src-cache-bust-2026-03-15-v2"

# Copy backend source
COPY src ./src/

# Copy the built React app from stage 1
COPY --from=frontend-builder /app/client/dist ./client/dist

# Railway injects PORT at runtime
ENV PORT=3000
ENV NODE_ENV=production
EXPOSE ${PORT}

# Wait for the database socket to accept connections, then start the API.
# Schema sync is a separate operational step and should not happen during app boot.
CMD ["sh", "-c", "node src/scripts/waitForDatabase.js && node src/server.js"]
