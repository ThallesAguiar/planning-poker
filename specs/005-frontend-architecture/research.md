# Research: Frontend Architecture Reorganization

## Decision: Retain React Router DOM and formalize its ownership

**Rationale**: React Router DOM 7.18 is already installed and `BrowserRouter` with `Routes` is active
in the frontend entry point. A route library requirement is therefore satisfied by moving the current
route map into a focused route layer with named path constants, parameter helpers, fallback handling,
and explicit route guards where current behavior requires them.

**Alternatives considered**:

- Add a second router: rejected because it duplicates navigation ownership and risks URL regressions.
- Keep route declarations in page files: rejected because direct paths and fallback behavior become
  harder to audit.

## Decision: Preserve Zustand instead of adding Redux

**Rationale**: The application already has one Zustand store holding room, connection, account, and
transient UI state. Replacing it to match an illustrative folder would be a state migration, not an
architecture reorganization, and would put live room recovery at risk.

**Alternatives considered**:

- Move global state to Redux: rejected because it changes state behavior without user value.
- Move all state to React context: rejected because room state has existing global-store semantics.

## Decision: Extract `App.tsx` by responsibility before moving leaf modules

**Rationale**: `App.tsx` currently contains home, authentication, room entry, REST calls, browser
storage, Socket.IO listeners, reconnect logic, and table handoff. Extracting page composition, pure
helpers, API clients, socket service, and reusable hooks in small slices makes import movement
testable and preserves cleanup ordering.

**Alternatives considered**:

- Bulk file moves first: rejected because broken imports obscure behavioral regressions.
- Leave `App.tsx` as an architecture exception: rejected because it defeats route-level composition.

## Decision: Treat paths, storage keys, selectors, and socket cleanup as compatibility contracts

**Rationale**: Existing Playwright tests and user bookmarks rely on seven route patterns; recovery
depends on localStorage/sessionStorage keys; socket listeners require exact cleanup to avoid duplicate
updates. These observable behaviors must remain stable through relocation.

**Alternatives considered**:

- Update URLs and selectors opportunistically: rejected because feature scope is preservation.
- Test only successful home navigation: rejected because deep links and reconnect flows are highest
  migration risk.

## Decision: Add a room Studio page using the public room code

**Rationale**: Page directories represent domain ownership. `pages/studio/room/index.tsx` owns the
new `/rooms/:code/studio` address while retaining the current public room identifier. It resolves the
room code using existing lookup behavior and relies on existing backend Studio authorization.

**Alternatives considered**:

- Use internal room ID in the public URL: rejected because existing room navigation uses codes.
- Keep Studio only as an in-table panel: rejected because it is not independently addressable or a
  route-level page.
