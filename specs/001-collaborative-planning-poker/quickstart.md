# Quickstart: Collaborative Real-Time Planning Poker

## Prerequisites

- Docker Desktop
- Node.js 22+
- Optional `LLM_API_KEY`, `LLM_BASE_URL`, and `LLM_MODEL` for AI participant tests; endpoint must support `/chat/completions`

## Start services

From repository root:

```powershell
docker compose up --build
```

Expected services: API on `http://localhost:3000`, PostgreSQL on `localhost:5432`, Redis on
`localhost:6380`. API startup applies development migrations after healthy dependencies.

## Start frontend

```powershell
cd frontend
npm install
npm run dev
```

Open Vite URL, normally `http://localhost:5173`.

## Verify primary flow

1. Create public room on `/`.
2. Open invite code in two browser sessions.
3. Join with different names and roles.
4. Present story, cast different cards, reveal, discuss, revote or finalize.
5. Send chat and reaction.
6. Disconnect one browser, reconnect, confirm current state and history.
7. Close session and open generated report.

## Verification commands

```powershell
cd frontend
npm run build
npm run lint

cd ..\api
npx prisma validate
npm run build
npm test
npm run test:e2e

cd ..
docker compose config --quiet
```

## Environment

Use `.env` or Compose injection for `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `ANTHROPIC_API_KEY`,
provider model, timeout, and export settings. Never commit real credentials.

## Troubleshooting

- API waits for health: inspect `docker compose ps` and service logs.
- Stale room state: verify PostgreSQL and Redis, then reconnect; do not edit client state.
- AI unavailable: continue human-only flow, inspect status, verify key and timeout.
- Private-room failure: re-enter password; server must return generic access failure without hash.
