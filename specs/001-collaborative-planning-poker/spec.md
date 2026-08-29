# Feature Specification: Collaborative Real-Time Planning Poker

**Feature Branch**: `001-collaborative-planning-poker`

**Created**: 2026-08-28

**Status**: Draft

**Input**: User description: `prompt.md`

## Clarifications

### Session 2026-08-28

- Q: Who may view and export a closed-room report? → A: Participants with a valid room session may
  view it; only the PO or an authorized Scrum Master may export it.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Create and run estimation room (Priority: P1)

As a Product Owner, I create a Planning Poker room, configure its rules, add backlog stories,
and conduct an estimation round with my team.

**Why this priority**: A working estimation session is the core product value.

**Independent Test**: Create a room, join it with multiple participants, present one story, cast
votes, reveal them, and finalize a value without using any other feature.

**Acceptance Scenarios**:

1. **Given** a new room, **When** the Product Owner configures its deck, timers, roles, and
   participant limits, **Then** the room shows those rules to every participant.
2. **Given** a participant has joined, **When** they choose a display name, avatar, and permitted
   role, **Then** they appear in the room with that identity and role.
3. **Given** a story is presented, **When** eligible participants cast cards, **Then** others see
   that each participant has voted without seeing vote values.
4. **Given** all eligible participants have voted or the reflection timer expires, **When** the
   Product Owner reveals cards, **Then** all eligible votes become visible at the same time with
   minimum, maximum, average, and consensus status.
5. **Given** a revealed round, **When** the Product Owner accepts a result or starts a revote,
   **Then** the story records the outcome or begins a new numbered round.

### User Story 2 - Collaborate through discussion and realtime presence (Priority: P1)

As a team member, I participate in estimation, discuss differences, react to the table, and remain
aware of room changes even when my connection briefly drops.

**Why this priority**: Collaboration and trustworthy shared state distinguish the product from a
single-user estimator.

**Independent Test**: Join a running room from at least two browser sessions, exchange chat messages,
cast different votes, discuss the result, disconnect one session, reconnect it, and verify the same
room state and history are restored.

**Acceptance Scenarios**:

1. **Given** a running round, **When** a participant sends a chat message or quick reaction,
   **Then** all connected participants see it associated with the room and current story when
   applicable.
2. **Given** revealed votes differ, **When** the discussion phase starts, **Then** the discussion
   timer and focused chat are visible and the Product Owner can end discussion or start a revote.
3. **Given** a participant loses connection, **When** they reconnect with the same room session,
   **Then** they receive current participants, story, round, timer state, votes permitted to them,
   and prior room history.
4. **Given** an observer joins, **When** a round is active, **Then** the observer can see the table
   and chat but cannot cast a vote or perform administrative actions.
5. **Given** a participant attempts an action outside their role, **When** the action is submitted,
   **Then** the action is rejected and room state remains unchanged.

### User Story 3 - Review and share sprint results (Priority: P2)

As a Product Owner or room participant with a valid session, I close or review a session and inspect a
permanent report showing how each story was estimated and how the team participated. Only the PO or an
authorized Scrum Master can export it.

**Why this priority**: The report turns a meeting into reusable delivery knowledge and completes the
session lifecycle.

**Independent Test**: Finalize multiple stories with different round counts and discussion lengths,
close the room, open its report, and verify story outcomes, timing, divergence, participation, and
chat evidence are present.

**Acceptance Scenarios**:

1. **Given** all desired stories have outcomes, **When** the Product Owner generates the sprint
   report, **Then** the room is marked closed and the report is available for later viewing.
2. **Given** stories were estimated through multiple rounds, **When** the report is opened,
   **Then** it shows final value, decision criterion, round count, total time, and initial versus
   final divergence for each story.
3. **Given** participants voted and discussed stories, **When** the report is opened, **Then** it
   shows voting participation, comment counts, and relevant justifications grouped by story.
4. **Given** a completed session, **When** the PO or an authorized Scrum Master requests an export,
   **Then** the report can be downloaded in PDF and CSV formats with the same core data.

### Edge Cases

- A room rejects new participants after its configured limit is reached.
- A private room rejects an incorrect password without revealing whether other private data exists.
- A participant submits a value not present in the configured deck; the vote is rejected.
- A participant submits a second vote in the same round; the latest accepted vote replaces the prior
  vote and progress counts the participant once.
- The Product Owner ends a round with missing votes; absent participants are excluded from the reveal
  statistics and the report records the incomplete participation.
- A timer reaches zero while a participant is disconnected; the server ends the phase and preserves
  the resulting state.
- No consensus is reached after a revote; the Product Owner must choose an allowed finalization
  criterion or continue a permitted revote.
- A story is skipped; it remains in the report with skipped status and no final estimate.
- The AI participant is enabled but unavailable; the session continues with a visible unavailable
  status and no fabricated vote.
- A room closes while clients are disconnected; later access is read-only and shows the final report.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST allow a Product Owner to create a named estimation room with a unique
  invitation code or link.
- **FR-002**: System MUST allow a participant to join using the invitation and choose a display name,
  avatar, and permitted role, with a guest path that does not require a full account.
- **FR-003**: System MUST support Product Owner, Scrum Master, Developer, QA, and Observer roles,
  with room-specific permitted roles and server-enforced permissions.
- **FR-004**: System MUST support public and password-protected rooms and MUST prevent unauthorized
  access to protected room state.
- **FR-005**: System MUST allow the Product Owner to configure deck type and values, reflection and
  discussion durations, participant limit, anonymous voting, automatic reveal, consensus criterion,
  revote policy, and AI participation.
- **FR-006**: System MUST allow the Product Owner to create, order, present, skip, and finalize backlog
  stories with title and description.
- **FR-007**: System MUST start a numbered voting round for the presented story and record its start
  and end times.
- **FR-008**: System MUST accept votes only from eligible participants and only for configured deck
  values.
- **FR-009**: System MUST hide vote values from other participants until an authorized reveal occurs.
- **FR-010**: System MUST show vote progress as the number of eligible participants who have voted,
  counting each participant once.
- **FR-011**: System MUST enable reveal when all eligible participants vote, the reflection timer ends,
  or the Product Owner forces reveal.
- **FR-012**: System MUST reveal votes together and provide minimum, maximum, average, mode when
  available, and consensus status.
- **FR-013**: System MUST start a discussion phase automatically when revealed votes diverge and MUST
  support a configurable discussion timer.
- **FR-014**: System MUST allow authorized participants to end discussion, start a revote, finalize
  a value using an allowed criterion, advance to the next story, or skip the story.
- **FR-015**: System MUST provide room chat, story-linked justifications, system messages, and quick
  reactions separate from official chat history.
- **FR-016**: System MUST broadcast relevant room changes to connected participants without requiring
  manual refresh or polling.
- **FR-017**: System MUST make the server authoritative for timers, phase transitions, permissions,
  reveal conditions, and final values.
- **FR-018**: System MUST restore the latest room state and chat history after a participant reconnects
  with a valid room session.
- **FR-019**: System MUST persist users, rooms, configuration, participants, stories, rounds, votes,
  chat messages, and reports for later retrieval.
- **FR-020**: System MUST allow horizontal room coordination without losing active-round state when
  more than one application instance serves participants.
- **FR-021**: System MUST allow the Product Owner to generate a report when closing a room and retain
  that report as a permanent session record.
- **FR-022**: System MUST include final values, criteria, round counts, total reflection and discussion
  time, initial and final divergence, relevant chat, justifications, voting participation, and comment
  participation in the report.
- **FR-023**: System MUST provide report viewing and authorized PDF and CSV export.
- **FR-029**: System MUST allow any participant with a valid room session to view a closed-room report
  while restricting PDF and CSV export to the Product Owner or an authorized Scrum Master.
- **FR-024**: System MUST support an optional AI participant that appears with a role and avatar,
  submits a configured deck value, and posts a concise story-based justification as a normal participant.
- **FR-025**: System MUST keep AI provider failures, timeouts, invalid values, and unavailable keys
  from blocking or fabricating the human estimation flow.
- **FR-026**: System MUST provide animated card play and reveal feedback, consensus celebration,
  selectable avatars, responsive table layout, optional sounds with mute, and a structure that allows
  future visual skins.
- **FR-027**: System MUST present usable loading, error, reconnecting, closed-room, empty-state, and
  timer-expired feedback.
- **FR-028**: System MUST protect passwords, session tokens, provider keys, and private room data from
  exposure in client-visible state or exported logs.

### Key Entities *(include if data involved)*

- **User**: Human or guest identity with display name, avatar, optional account details, and creation
  time.
- **Room**: Planning Poker session with invitation, visibility, owner, status, configuration, and
  lifecycle timestamps.
- **Room Configuration**: Rules for deck, timing, roles, participant limits, privacy, reveal,
  consensus, revotes, and AI participation.
- **Room Participant**: User's membership, role, active/disconnected status, AI flag, and join time.
- **Story**: Ordered backlog item with title, description, status, final value, criterion, timing,
  and round count.
- **Vote Round**: One estimation attempt for a story with number and lifecycle timestamps.
- **Vote**: Participant's selected deck value and play/reveal state within a round.
- **Chat Message**: Room or story-linked comment, justification, or system event with author and time.
- **Sprint Report**: Permanent aggregate of session outcomes, participation, discussion evidence,
  achievements, and export references.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of first-time users can create or join a room and cast their first vote
  within 3 minutes without assistance.
- **SC-002**: In a session with 10 concurrent participants, 95% of room-state changes become visible
  to other connected participants within 2 seconds.
- **SC-003**: After reconnecting within 30 seconds, 99% of participants recover the latest room phase,
  story, timer, and permitted vote state without manual page reload.
- **SC-004**: A Product Owner can complete a five-story session and open its report within 1 minute
  after finalizing the last story.
- **SC-005**: 100% of recorded votes remain hidden before authorized reveal in acceptance and security
  tests.
- **SC-006**: 100% of administrative actions attempted by unauthorized roles are rejected in
  authorization tests.
- **SC-007**: At least 90% of pilot participants rate the session as clear, engaging, and suitable
  for team planning.

## Assumptions

- Participants have a modern browser and a stable network connection for normal operation.
- Version 1 targets desktop-first responsive web use; mobile support means usable responsive layouts,
  not a native application.
- Guest participation is the default low-friction entry path; full account history is optional.
- The Product Owner is the primary authority for room configuration, reveal, finalization, and report
  generation unless configured Scrum Master permissions explicitly allow a subset.
- Room data and reports are retained for the lifetime of the application unless a later retention
  policy is introduced.
- The AI participant is optional and depends on a configured provider credential, but human-only play
  remains fully functional when it is disabled or unavailable.
- PDF and CSV exports contain the same report facts and may use a presentation-specific layout.
- Accessibility follows common web expectations: keyboard access for core actions, readable contrast,
  clear status text, and motion that can be muted or reduced where supported.
