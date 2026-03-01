# ─────────────────────────────────────────────────────────────────────────────
# AdPilot Backend — Production Dockerfile
# Uses node:20-slim + Chrome system deps for Puppeteer / Lighthouse
# ─────────────────────────────────────────────────────────────────────────────

FROM node:20-slim AS base

# Install Chrome OS-level dependencies required by Puppeteer's bundled browser
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

# Copy manifests first to leverage Docker layer cache
COPY package*.json ./
COPY prisma ./prisma/

# Install all deps (including devDeps — we need prisma CLI for migrations)
RUN npm ci

# Generate Prisma client
RUN npx prisma generate

# Copy application source
COPY src ./src/

EXPOSE 3000

# Run migrations then start the server
CMD ["sh", "-c", "npx prisma migrate deploy && node src/server.js"]
