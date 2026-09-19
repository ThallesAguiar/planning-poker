# Feature Specification: Frontend Architecture Reorganization

**Feature Branch**: `005-frontend-architecture`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Reorganizar a arquitetura do frontend conforme a imagem, adicionar biblioteca de rotas e validar que os fluxos não quebraram com build, lint e testes de navegador."

## Clarifications

### Session 2026-09-18

- Q: O Studio dentro da mesa deve virar somente link para `/rooms/:code/studio`, removendo painel atual? → A: Sim. O Studio do usuário permanece em `/studio`; o Studio da mesa passa a ser a página canônica `/rooms/:code/studio`.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Use Existing Product Flows (Priority: P1)

As a Planning Poker participant, I can use each existing product flow after the frontend is
reorganized, without observing changed behavior or broken navigation.

**Why this priority**: Architecture change only has value if it preserves product availability.

**Independent Test**: Open each existing public URL and complete representative home, room, account,
and report journeys; results match behavior before reorganization.

**Acceptance Scenarios**:

1. **Given** an existing public application URL, **When** a user opens or refreshes it, **Then** the
   intended screen loads without a missing-page or blank-screen failure.
2. **Given** an authenticated or guest user, **When** they navigate among currently supported screens,
   **Then** access checks and destination content remain unchanged.
3. **Given** a user enters a room through its invitation URL, **When** the room is available, **Then**
   they reach the same room-entry and table experience as before the reorganization.

---

### User Story 2 - Maintainable Frontend Boundaries (Priority: P2)

As a developer, I can locate frontend responsibilities consistently so future changes have a clear
home and do not mix page composition, reusable interface, shared state, static content, external
communication, and general-purpose helpers.

**Why this priority**: Predictable ownership reduces regression risk and makes product work faster.

**Independent Test**: Inspect source organization and confirm every active frontend module is placed
in one documented responsibility area or has a justified compatibility bridge.

**Acceptance Scenarios**:

1. **Given** a developer needs a route-level screen, **When** they inspect the frontend, **Then** they
   can find it in the page-composition area.
2. **Given** a developer needs reusable presentation or layout, shared state, static content, external
   communication, custom logic, or pure helpers, **When** they inspect the frontend, **Then** each
   responsibility has one discoverable location.
3. **Given** a module is moved, **When** another module imports it, **Then** no stale import path remains.

---

### User Story 3 - Predictable Navigation (Priority: P3)

As a user, I can navigate or refresh every supported application address and receive the intended
screen, including protected and parameterized destinations.

**Why this priority**: Central navigation prevents regressions caused by distributed address handling.

**Independent Test**: Visit all current address patterns directly, use in-app navigation, and refresh
each destination.

**Acceptance Scenarios**:

1. **Given** any supported application address, **When** a user visits it directly, **Then** it resolves
   to its intended screen.
2. **Given** an address requiring existing session or room-entry conditions, **When** those conditions
   are not met, **Then** the user receives the current recovery or entry experience rather than unsafe
   content.

---

### Edge Cases

- A direct visit or refresh occurs on a room, report, account, or unknown address.
- A user reaches a protected destination with an expired, absent, or guest session.
- Static assets, lazy-loaded screens, or external requests resolve from their new locations.
- A compatibility path is temporarily needed during migration; it must not create duplicate active
  implementations or inconsistent user behavior.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend MUST organize active modules into discoverable responsibility areas for
  external communication, static assets, reusable components, shared state, static content, custom
  logic, page composition, and pure helpers.
- **FR-002**: The frontend MUST distinguish reusable interface and layout elements from page-level
  composition.
- **FR-003**: The frontend MUST provide one maintained navigation map for all current application
  addresses, including parameterized, protected, and fallback destinations.
- **FR-004**: The frontend MUST preserve all existing public URLs and their user-visible behavior.
- **FR-005**: The frontend MUST preserve current session, room-entry, authorization, realtime, report,
  and error-recovery behavior after module relocation.
- **FR-006**: The frontend MUST remove obsolete import references after relocation and leave no duplicate
  active module implementations.
- **FR-007**: The delivered change MUST include automated checks for compilation, code quality, and
  representative browser journeys covering direct navigation and critical existing flows.
- **FR-008**: The project task tracker MUST record changed frontend structure, verification evidence,
  remaining migration work, and recommended next order, compared against `prompt.md`.
- **FR-009**: The frontend MUST preserve the user Studio at `/studio` and provide the room Studio only
  at `/rooms/:code/studio`, using the existing public room code with the same account-owner
  authorization and protected configuration behavior as the current in-room Studio experience.
- **FR-010**: The frontend MUST replace the editable in-room Studio panel with navigation to the room
  Studio page and MUST NOT retain two editable interfaces for the same room configuration.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of current supported application addresses resolve successfully when opened directly
  and when refreshed.
- **SC-002**: 100% of selected critical journeys for home, account access, room entry, active room, and
  report access pass automated browser checks.
- **SC-003**: 0 unresolved import references or duplicate active implementations remain after migration.
- **SC-004**: A developer can identify intended responsibility area for every active frontend module
  during a source review without relying on undocumented conventions.
- **SC-005**: 100% of automated room Studio authorization cases allow the room owner and reject guest,
  non-owner, unavailable-room, and invalid-code access without exposing protected configuration.

## Assumptions

- Existing user-visible behavior and URLs are the compatibility baseline; this feature does not add
  product capabilities.
- Existing authorization and room-entry rules remain unchanged.
- The current frontend's established global-state approach remains valid; reorganization does not
  require replacing it.
- Automated browser coverage will use the project's existing end-to-end test setup.
