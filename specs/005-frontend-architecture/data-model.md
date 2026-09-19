# Frontend Responsibility Model

This feature creates no persisted database entities and does not alter shared backend contracts. Its
model defines ownership boundaries used to place active frontend modules.

## ModuleBoundary

| Field | Description | Validation |
|---|---|---|
| name | Responsibility area name | Unique within `src`; named in English |
| responsibility | Work owned by the area | Must not duplicate another active area |
| allowedDependencies | Areas it may import | Must avoid page-to-page and circular dependencies |
| migrationState | `planned`, `migrated`, or `compatibility` | Compatibility state requires removal task |

## RouteDefinition

| Field | Description | Validation |
|---|---|---|
| path | Public address pattern | Preserves every current path exactly |
| page | Route-level composition owner | One page owner per route pattern |
| accessCondition | Existing account or room-entry requirement | Must preserve current recovery behavior |
| fallback | Result for unmatched address | Returns user to existing home destination |

The room Studio `RouteDefinition` has path `/rooms/:code/studio`. Its `accessCondition` first resolves
the public code to the existing room identity, then applies existing account-owner authorization before
loading any Studio configuration.

## BrowserSessionBoundary

| Field | Description | Validation |
|---|---|---|
| key | Existing browser-storage key family | No key rename without compatibility migration |
| scope | Account or guest plus room code | Must remain isolated by current scope |
| owner | Hook, API client, or service that reads it | One primary owner after migration |
| lifecycle | Create, restore, clear | Must preserve current join, reconnect, and logout behavior |

## State Transitions

1. A direct path resolves to its `RouteDefinition` and page owner.
2. Page composes hooks, API clients, services, reusable components, and existing global state.
3. Room join or restoration reads `BrowserSessionBoundary`, then connects through the socket service.
4. Socket updates modify the existing global state; page renders current view.
5. Logout, rejection, or removal clears only storage defined by current behavior and navigates to the
   existing recovery destination.
