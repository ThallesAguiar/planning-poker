# Data Model: User Auth Rooms

## Registered User

Persistent account used for login, room history, ownership, and membership reuse.

**Fields**:

- `id`: stable unique identity.
- `email`: unique login identifier.
- `passwordHash`: one-way hashed credential.
- `name`: default display name.
- `avatarUrl`: default account avatar.
- `isGuest`: false for registered accounts.
- `createdAt`: account creation time.
- `updatedAt`: last account profile update time.

**Validation**:

- Email must be unique and valid.
- Password hash must never be exposed.
- Password must satisfy minimum strength selected during implementation.

## Guest User

Temporary participant identity created by room entry without registration.

**Fields**:

- `id`: guest identity.
- `name`: display name.
- `avatarUrl`: avatar shown in rooms.
- `isGuest`: true.
- `createdAt`: creation time.

**Validation**:

- Guest identity can join rooms but does not provide cross-device room history.
- Guest membership can be claimed only when active session proof matches.

## Room Membership

Durable relationship between user identity and room. This is duplicate-prevention boundary.

**Fields**:

- `id`: participant/membership identity.
- `roomId`: linked room.
- `userId`: linked registered or guest user.
- `role`: room role.
- `isAI`: whether participant is AI.
- `status`: active, disconnected, removed.
- `roomDisplayName`: optional room-specific name.
- `roomAvatarUrl`: optional room-specific avatar.
- `joinedAt`: first join time.
- `lastSeenAt`: last activity or reconnect time.

**Relationships**:

- Belongs to one room.
- Belongs to one user.
- Owns votes and chat messages.

**Validation**:

- Only one membership per `(roomId, userId)`.
- Registered account reentry must reuse membership.
- Different users may share display name.
- Non-member private-room join requires correct password.

## Room Profile Change Request

Participant request to change room-specific display identity or role.

**Fields**:

- `id`: request identity.
- `roomId`: target room.
- `requesterParticipantId`: participant asking for change.
- `requestedName`: optional room display name.
- `requestedAvatarUrl`: optional room avatar.
- `requestedRole`: optional room role.
- `status`: pending, approved, rejected, cancelled.
- `decidedByParticipantId`: host participant who decided.
- `createdAt`: request time.
- `decidedAt`: decision time.

**Validation**:

- Only active room participants may request changes.
- At least one changed field is required.
- Only current host may approve or reject.
- Role changes must use allowed room roles.
- Approved request updates membership and broadcasts room state.
- Rejected request changes no visible participant data.

## Account Session

Authenticated account access.

**Fields**:

- `token`: signed account session token.
- `userId`: registered user identity.
- `expiresAt`: session expiration.

**Validation**:

- Expired or invalid sessions are rejected.
- Room list and account profile require valid account session.
- Room websocket join may include account-backed room session.

## State Transitions

### Room Membership

```text
not_member -> member_active
member_active -> member_disconnected
member_disconnected -> member_active
member_active -> member_removed
```

### Room Profile Change Request

```text
pending -> approved
pending -> rejected
pending -> cancelled
```

Only pending requests may be decided.
