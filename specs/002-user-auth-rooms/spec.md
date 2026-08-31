# Feature Specification: User Auth Rooms

**Feature Branch**: `002-user-auth-rooms`

**Created**: 2026-08-31

**Status**: Draft

**Input**: User description: "$speckit-specify prompt.md TASKS.md preciso criar login e cadastro de usuario, pq fica salvo as salas que estou vinculado, como esta hoje você cria uma sessão, e se sair fica logado na mesa, e depois não consigo ver a mesa que eu estava, se eu entrar na mesma mesa, ele cria uma nova sessão então fica dois usuarios iguais. Quando estou na mesa eu posso alterar o meu perfil com permissão do host da mesa. Não altere os estilos, esta do jeito que quero, só as funcionalidades não estão certas. E sobre as tasks eu quero que use as tasks das specks e não TASKS.md como base de tasks"

## Clarifications

### Session 2026-08-31

- Q: How should account and guest room history work? -> A: Account saves rooms; guest remains temporary; guest may migrate current room membership when registering in the same active session.
- Q: Which room profile changes need host approval? -> A: Name/avatar changes apply directly; role changes require host approval.
- Q: What should logout do to an active room session? -> A: Logout disconnects the active table session in that browser, keeps room membership saved, and later reentry reuses the same membership without duplicating the participant.
- Q: What data migrates when a guest creates an account from an active room session? -> A: Transfer the guest room membership, votes, and chat messages to the registered account.
- Q: What account credential and session rules should registration enforce? -> A: E-mail must be unique, password must have at least 8 characters, and account sessions expire after 12 hours.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Account Access Keeps Room History (Priority: P1)

A person can create an account, log in later, and see every room where they are a member, so leaving the browser or opening the app again does not lose the rooms they already joined.

**Why this priority**: This fixes the core product gap: rooms currently depend on local session state, so users cannot reliably find previous rooms.

**Independent Test**: Can be tested by registering a user, joining a room, logging out, logging back in, and confirming the joined room appears in "Minhas Salas" with access back to the same table.

**Acceptance Scenarios**:

1. **Given** a registered user has joined a room, **When** the user logs out and logs back in, **Then** the room appears in the user's room list.
2. **Given** a registered user opens "Minhas Salas", **When** the user selects a previously joined room, **Then** the same room table opens with their existing membership.
3. **Given** a user has no rooms yet, **When** they open "Minhas Salas", **Then** the app shows an empty state and does not create any room or participant automatically.
4. **Given** a registered user is currently inside a room, **When** they log out, **Then** the browser disconnects from the active table and the room remains saved for later login.

---

### User Story 2 - Same User Rejoins Without Duplicates (Priority: P1)

A logged-in person who enters the same room again is restored as the same participant instead of creating another duplicate player with the same name.

**Why this priority**: Duplicate participants break voting accuracy, participant counts, room ownership, and trust in the planning session.

**Independent Test**: Can be tested by joining a room, leaving or closing the app, entering the same room code again, and confirming the participant list contains only one entry for that account.

**Acceptance Scenarios**:

1. **Given** a logged-in user already belongs to a room, **When** they enter the same room code again, **Then** the app opens the table using the existing participant identity.
2. **Given** a logged-in user is disconnected from a room, **When** they reconnect from another browser tab or device, **Then** the existing participant becomes active again instead of creating a duplicate.
3. **Given** two different accounts use the same display name, **When** both join the same room, **Then** they remain distinct participants because account identity is different.

---

### User Story 3 - Role Changes Require Host Permission In Room (Priority: P2)

While inside a room, a participant can change their room display name or avatar directly, and can request role changes for host approval.

**Why this priority**: Room identity must be editable but controlled, especially when role changes affect permissions.

**Independent Test**: Can be tested by a participant changing name/avatar directly, then requesting a role change inside a room and a host approving it, then confirming all room participants see the updated profile.

**Acceptance Scenarios**:

1. **Given** a participant is in a room, **When** they change their room name or avatar, **Then** every participant sees the updated name or avatar without host approval.
2. **Given** a participant requests a role change, **When** the host receives the request, **Then** the role remains unchanged until the host approves.
3. **Given** the host approves a role change, **When** the approval is saved, **Then** every participant sees the updated role and room permissions update.
4. **Given** the host rejects a role change, **When** the rejection is saved, **Then** the participant keeps the previous role.

---

### User Story 4 - Account Session Does Not Change Current Visual Design (Priority: P3)

Users can log in, register, see linked rooms, rejoin rooms, change room profile data, and request role changes without changing the current visual layout, styles, table design, or entry screen appearance.

**Why this priority**: The visual design is already approved; this feature must fix behavior without redesigning screens.

**Independent Test**: Can be tested by comparing the existing entry and table screens before and after the feature and confirming only functional account controls and data states changed.

**Acceptance Scenarios**:

1. **Given** the current entry screen exists, **When** login or registration controls are added, **Then** the current layout and visual style remain consistent.
2. **Given** the current poker table screen exists, **When** profile and account behavior is added, **Then** the table layout, card design, and room visual style remain unchanged.

### Edge Cases

- If a user tries to register with an email that already exists, the app must show a clear message and offer login instead.
- If a user tries to register with a password shorter than 8 characters, the app must reject registration with a clear message.
- If a logged-in user enters a private room with the correct code but wrong password and is not already a member, the app must keep them outside the table.
- If a logged-in user is already a member of a private room, rejoining from "Minhas Salas" must not ask for the room password again.
- If the host leaves the room temporarily, pending role change requests must remain pending and not auto-approve.
- If the same account opens the same room in multiple tabs, the room must still show one participant identity.
- If a guest participant later creates an account in the same active browser session, the app must attach their current room membership to the new account and avoid leaving duplicate guest/account participants.
- If a migrated guest already voted or chatted in the room, those votes and messages must remain attributed to the same visible participant after migration to the registered account.
- If a logged-in user logs out while inside a room, the app must close the active table session in that browser but preserve the saved membership for future login.
- If an account session is older than 12 hours, the app must require login again before showing account-only data such as "Minhas Salas".

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a person to create an account with a unique login identifier and secure credential.
- **FR-001a**: System MUST require unique e-mail and password with at least 8 characters for account registration.
- **FR-002**: System MUST allow a registered person to log in and log out.
- **FR-002a**: System MUST expire account sessions after 12 hours and require login again for account-only actions.
- **FR-003**: System MUST keep a registered user's room memberships after logout, browser close, or later return.
- **FR-003a**: System MUST disconnect the active browser table session on logout while preserving the user's room memberships.
- **FR-004**: System MUST show registered users a list of rooms they own or have joined.
- **FR-005**: System MUST let a registered user reopen a linked room from the room list without creating a new participant.
- **FR-006**: System MUST use account identity to prevent duplicate participants when the same user rejoins the same room.
- **FR-007**: System MUST preserve the existing guest-style room entry flow for users who do not want to register before joining.
- **FR-008**: System MUST let a guest in an active browser session attach their current room membership to a newly created account when the app can verify that session, and MUST prevent duplicate guest/account participants for that room.
- **FR-008a**: System MUST preserve and transfer the guest participant's room membership, votes, and chat messages when migrating that active session to a registered account.
- **FR-009**: System MUST prevent wrong room passwords from creating memberships or opening the table for non-members.
- **FR-010**: System MUST let existing members rejoin private rooms from their saved room list without re-entering the room password.
- **FR-011**: System MUST allow a participant inside a room to change their room display name and avatar directly.
- **FR-012**: System MUST require host approval before applying room role changes requested by another participant.
- **FR-013**: System MUST allow the host to approve or reject pending room role change requests.
- **FR-014**: System MUST notify the requester whether the host approved or rejected the requested room role change.
- **FR-015**: System MUST update the room participant list for everyone after a direct name/avatar change or approved role change.
- **FR-016**: System MUST keep global account profile and room-specific profile separate, so a change in one room does not unexpectedly alter another room.
- **FR-017**: System MUST keep current entry screen, room screen, cards, colors, layout, and visual style unchanged except for controls strictly needed for account/profile behavior.
- **FR-018**: System MUST use specification-local task files for this feature's planning and task tracking, not the root task file as the source of implementation tasks.

### Key Entities

- **Registered User**: A person with a persistent account, login identifier, credential, display profile, and account status.
- **Guest User**: A temporary participant identity that can join rooms without registration and may later be linked to an account during the same active session.
- **Room Membership**: Persistent relationship between a user identity and a room, including role, room-specific display name, avatar, membership status, and join history.
- **Room Profile Change Request**: A requested change to room-specific participant role, submitted by a participant and decided by the host.
- **Host Approval Decision**: Host action that approves or rejects a pending room role change request with timestamp and requester.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 95% of returning registered users can find and reopen a previously joined room in under 30 seconds.
- **SC-002**: Rejoining the same room 10 times with the same registered account results in exactly one participant identity in that room.
- **SC-003**: 100% of wrong-password attempts by non-members keep the user outside the poker table.
- **SC-004**: 95% of direct room name/avatar changes and approved role changes become visible to all active room participants within 2 seconds.
- **SC-005**: Existing entry and table screen visual regression checks show no unintended layout or style changes outside account/profile controls.
- **SC-006**: Users can complete registration and join or rejoin a room in under 2 minutes.

## Assumptions

- Email and password are acceptable for the first account flow unless a later clarification selects another identity method.
- A "host" means the current room owner or participant with room ownership permissions.
- Room profile means the identity shown inside one room, not necessarily the user's global account profile.
- Guest access remains supported because the original Planning Poker flow is lightweight and link-based; guest history remains temporary unless the current room membership is migrated during account registration in the same active browser session.
- This specification creates the product behavior; implementation tasks for this feature will be generated under this feature's `specs/002-user-auth-rooms/` directory.
