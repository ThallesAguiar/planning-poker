# Navigation and Module Boundary Contract

## Stable navigation contract

| Address | Destination responsibility | Compatibility rule |
|---|---|---|
| `/` | Home and account entry page | Preserve current query-string behavior, including room creation entry |
| `/rooms` | Saved rooms page | Preserve current account recovery behavior |
| `/profile` | Profile page | Preserve current account recovery behavior |
| `/settings` | Settings page | Preserve current account recovery behavior |
| `/studio` | AI studio page | Preserve current account recovery behavior |
| `/room/:code` | Room entry and table page | Preserve guest/account restoration, private-room, and reconnect behavior |
| `/rooms/:code/studio` | Room Studio page | Resolve code using current room lookup, then require existing account-owner authorization |
| `/report/:id/:roomCode?` | Report page | Preserve optional room-code handling and authenticated downloads |
| unmatched path | Fallback route | Redirect to `/` |

## Boundary contract

| Area | Owns | Must not own |
|---|---|---|
| `api` | HTTP request functions, response mapping, authentication headers | Page rendering or socket lifecycle |
| `components` | Reusable layout, room, and UI presentation | Route selection or browser-storage policy |
| `context` | Scoped provider concerns | Replacement for existing global state without a migration decision |
| `data` | Immutable app data | Mutable session state |
| `hooks` | Reusable React lifecycle and orchestration | Page markup or duplicated global state |
| `pages` | Route-level composition | Reusable cross-page UI or raw HTTP implementation |
| `routes` | Named paths, route map, guards, fallback | Domain rendering or socket commands |
| `services` | Socket connection and commands | JSX or route declaration |
| `stores` | Existing Zustand global state | Network transport implementation |
| `utils` | Pure transformations | React hooks, I/O, or mutable state |

## Migration compatibility rules

1. Existing exports may be bridged temporarily only while all consumers migrate in same change.
2. Old and new implementations must not both subscribe to same Socket.IO event.
3. Storage key names, route parameter encoding, Portuguese UI labels, and critical CSS selectors remain
   stable unless matching browser test changes in same task.
4. Circular imports, stale paths, and duplicate active modules block completion.
5. The in-table Studio entry must navigate to `/rooms/:code/studio`; its form implementation must be
   shared with the route page or removed, never duplicated.
