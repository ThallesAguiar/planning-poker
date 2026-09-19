# Quickstart: Validate Frontend Architecture Reorganization

## Prerequisites

- Node.js 22 or later and project dependencies installed.
- API, PostgreSQL, and Redis available for browser journeys that create rooms, authenticate, or use
  realtime behavior.
- Frontend development server available at configured `FRONTEND_URL`; API origin configured through
  `VITE_API_URL`.

## Validation sequence

From `frontend/`:

```powershell
npm run build
npm run lint
$env:FRONTEND_URL='http://localhost:5173'
$env:VITE_API_URL='http://localhost:3333'
npm run test:e2e
```

Expected results:

1. Build reports no TypeScript or bundling errors.
2. Lint reports no source violations.
3. Playwright suites for authentication, room entry, room rounds, reports, and visual baseline pass.
4. Room Studio coverage confirms `/rooms/:code/studio` loads for owner and blocks guest, non-owner,
   unknown-code, and refresh scenarios without exposing configuration.

## Deep-link smoke checks

With frontend and API running, open and refresh each address in
[navigation-and-boundaries.md](./contracts/navigation-and-boundaries.md). Verify valid pages load,
room/report parameters remain intact, protected states show current recovery experience, and an
unknown address redirects to home.

## Architecture review

Compare active `frontend/src` modules with the responsibility table in
[navigation-and-boundaries.md](./contracts/navigation-and-boundaries.md). Confirm no stale imports,
duplicate active modules, or duplicate Socket.IO listeners remain. Record evidence and remaining work
in `TASKS.md` before completion.
