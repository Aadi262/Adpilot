# AdPilot Session Memory

## Setup Pattern
When starting AdPilot in a fresh environment:

1. **Docker containers**: Project reuses sdn-postgres (port 5432) and sdn-redis (port 6379) from staledealnagger project rather than running separate adpilot containers from docker-compose.yml.

2. **.env file location**: `/Users/vedangvaidya/Desktop/Projects/Adpilot/.env`
   - Must include: DATABASE_URL, REDIS_URL, JWT_SECRET, JWT_REFRESH_SECRET, PORT, NODE_ENV, FRONTEND_URL
   - Dev defaults are safe and committed

3. **Initial database setup**:
   - Create database: `docker exec sdn-postgres psql -U postgres -c "CREATE DATABASE adpilot;"`
   - Apply schema: `npx prisma db push --skip-generate`

4. **Service startup**:
   - Backend: `npm run dev` (port 3000, uses nodemon)
   - Frontend: Already running or `cd client && npm run dev` (port 5173, Vite)

## Common Port Conflicts
- If port 5432 or 6379 are already taken by sdn-postgres/sdn-redis from staledealnagger, reuse them rather than starting adpilot containers
- .env DATABASE_URL should point to existing postgres on 5432, not a new container

## Project Structure
- Backend source: `/Users/vedangvaidya/Desktop/Projects/Adpilot/src/`
- Frontend source: `/Users/vedangvaidya/Desktop/Projects/Adpilot/client/`
- Prisma schema: `/Users/vedangvaidya/Desktop/Projects/Adpilot/prisma/schema.prisma`
- Migrations: `/Users/vedangvaidya/Desktop/Projects/Adpilot/prisma/migrations/`

## API Endpoints
- Health check: GET http://localhost:3000/health
- Register: POST http://localhost:3000/api/v1/auth/register (requires: email, password, firstName, lastName, name, teamName)
- Login: POST http://localhost:3000/api/v1/auth/login
- Docs: http://localhost:3000/api/v1/campaigns (example)
