'use strict';

const { PrismaClient } = require('@prisma/client');

const WAIT_MS = Number(process.env.DB_WAIT_TIMEOUT_MS || 60000);
const STEP_MS = Number(process.env.DB_WAIT_INTERVAL_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function canConnect() {
  const prisma = new PrismaClient({
    log: [],
  });

  try {
    await prisma.$connect();
    await prisma.$queryRawUnsafe('SELECT 1');
    return true;
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

async function main() {
  const startedAt = Date.now();
  let attempt = 0;

  while ((Date.now() - startedAt) < WAIT_MS) {
    attempt += 1;

    try {
      const ok = await canConnect();
      if (ok) {
        process.stdout.write(`Database ready after ${attempt} attempt(s)\n`);
        process.exit(0);
      }
    } catch (err) {
      process.stderr.write(`Database not ready yet (attempt ${attempt}): ${err.message}\n`);
    }

    await sleep(STEP_MS);
  }

  process.stderr.write(`Database did not become ready within ${WAIT_MS}ms\n`);
  process.exit(1);
}

main().catch((err) => {
  process.stderr.write(`${err.message}\n`);
  process.exit(1);
});
