# Research: User Auth Rooms

## Decision: Email and password for first registered account flow

**Rationale**: Project already uses lightweight JWT guest sessions and bcrypt for protected room access. Email/password provides local account persistence without external provider setup.

**Alternatives considered**:

- OAuth-only login: rejected for MVP because provider setup adds environment and UX scope.
- Magic link: rejected because no email delivery system exists.
- Guest-only persistence: rejected because it does not solve cross-browser room history.

## Decision: Registered user identity owns room membership reuse

**Rationale**: Existing room participants already have unique `(roomId, userId)` membership. Reusing registered account identity as stable user identity prevents duplicate participants when the same person rejoins the same room.

**Alternatives considered**:

- Deduplicate by display name: rejected because two people can share a name.
- Deduplicate by browser token only: rejected because logout/browser changes lose history.
- Create new guest session every entry: rejected because this is the current bug.

## Decision: Keep guest entry and allow verified guest claim

**Rationale**: Original Planning Poker flow is lightweight and invite-based. Guests should still enter fast. When a guest creates an account in the same active browser session, current room membership can be attached to the account if session proof matches.

**Alternatives considered**:

- Force login before room entry: rejected because it changes approved product flow.
- Never link guest membership: rejected because users would lose current room after registration.

## Decision: Existing private-room members rejoin without password

**Rationale**: Existing membership is enough to reopen saved private rooms. Non-members still need correct room password before membership creation.

**Alternatives considered**:

- Always require room password: rejected because it breaks saved-room UX.
- Store private room passwords long term in browser: rejected because it increases credential exposure.

## Decision: Room profile changes require host approval

**Rationale**: Name, avatar, and role affect room trust and permissions. Host approval prevents role escalation and confusing identity changes during estimation.

**Alternatives considered**:

- Self-service name/avatar change: rejected because user explicitly required host permission.
- Host approval only for role change: rejected because display identity changes still affect room trust and history.

## Decision: Preserve visual style by reusing existing surfaces

**Rationale**: User approved current styling and requested functionality only. Account controls should reuse existing entry/dashboard/table surfaces and styles.

**Alternatives considered**:

- Dedicated auth redesign: rejected because it violates style constraint.
- New profile/admin layout: rejected for MVP because current views already exist.
