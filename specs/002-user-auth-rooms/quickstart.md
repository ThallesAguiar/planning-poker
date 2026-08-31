# Quickstart: User Auth Rooms

## Goal

Validate account registration, login, room history, duplicate-free rejoin, private room access, and host-approved room profile changes without altering approved visual style.

## Prerequisites

- API, PostgreSQL, and Redis running from Docker Compose.
- Frontend dev server running on local Vite port.
- Database migrations applied.

## Manual Acceptance Flow

1. Register a new user from the existing entry/account surface.
2. Create or join a private room.
3. Confirm table opens with current approved visual design.
4. Leave the room or log out.
5. Log in again with same account.
6. Open "Minhas Salas".
7. Confirm previous room appears.
8. Reopen room from "Minhas Salas".
9. Confirm no room password is requested for existing private-room member.
10. Confirm participant list contains only one entry for the account.
11. Open same room in another tab with same account.
12. Confirm participant list still contains one account identity.
13. From non-host participant, request room profile change.
14. From host, approve request.
15. Confirm every connected client sees updated participant profile within 2 seconds.
16. Repeat profile request and reject it.
17. Confirm participant profile stays unchanged.

## Automated Gates

Run after implementation:

```powershell
cd api
npx prisma validate
npm run build
npm test
```

```powershell
cd frontend
npm run build
npm run lint
$env:FRONTEND_URL='http://localhost:5173'; npm run test:e2e -- tests/room-entry.spec.ts --browser=chromium
```

Add or extend E2E coverage for:

- registration then room appears in "Minhas Salas";
- login then rejoin existing room;
- same account rejoin does not duplicate participant;
- wrong password for non-member does not enter room;
- existing private-room member rejoin does not ask password;
- profile request approval updates table;
- profile request rejection keeps previous profile;
- entry/table visual shell remains current style.
