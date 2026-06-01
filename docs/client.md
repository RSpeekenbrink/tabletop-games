# Client internals

`packages/client` is a React + Vite SPA with a responsive 2D UI that
works on desktop and mobile (portrait). State synchronisation is handled
by `colyseus.js`.

## Boot

`src/main.tsx` mounts `<App />` inside `BrowserRouter`. It imports concrete
game modules for their registration side effects (`import "./games/secret-hitler/index.js";`)
so the client registry is populated before any component mounts.

`src/App.tsx`:

- Reads the persisted session from `localStorage` on first mount. If
  present, calls `colyseusClient.reconnect(token)`. On success, sets the
  room in the store and routes to `/lobby` or `/game` based on
  `state.phase`. On failure, clears the session and routes to `/`.
- Registers an `onLeave` handler on the active room that clears the
  session and routes back to the landing screen when the connection drops.
- Renders the three routes (Landing, Lobby, GameView) plus a wildcard that
  navigates back to `/`.

## The Colyseus client

`src/net/colyseusClient.ts` exports a singleton:

```ts
export const colyseusClient = new Client(resolveEndpoint());
```

`resolveEndpoint()` honours `VITE_COLYSEUS_URL` if set, otherwise builds
`ws[s]://<host>` from `location`. In dev Vite proxies `/api`, `/matchmake`,
and `/colyseus` to the Colyseus server on port `2567`. In production the
server hosts both the WebSocket and the static client bundle, so the same
origin works for both.

## The room store

`src/net/roomStore.ts` is a tiny zustand store:

```ts
interface RoomStore {
  room: Room<LobbyState> | null;
  setRoom: (room: Room<LobbyState> | null) => void;
}
```

`setRoom` does one important side effect: when it accepts a non-null room,
it synchronously calls `setupRoomHandlers(room)` on every registered
client game (see "Client game registry" below). This is critical because
the server can push private messages (your role, your initial hand) the
moment the game starts. If we waited until the `GameView` component
mounted, those messages would arrive at an empty dispatcher and be dropped
with `Room.js: onMessage() not registered for type ...`.

## Session storage

`src/net/session.ts` reads and writes `localStorage["tabletop-games:session"]`
as JSON:

```ts
interface StoredSession {
  roomId: string;
  reconnectionToken: string;
  username: string;
}
```

Written on every successful `create` / `joinById`, cleared on logout, leave,
or failed reconnect.

## Screens

Three screens, each mapped to a route in `App.tsx`.

### Landing (`/`)

`src/screens/Landing.tsx` is the entry point: enter a username, then either
"Create room" or "Join by code".

- **Create**: `colyseusClient.create("tabletop-games", { username })`,
  persists the session, sets the room, navigates to `/lobby`.
- **Join**: `fetch("/api/rooms/<shortcode>")` to resolve the shortcode to
  a real `roomId`, then `colyseusClient.joinById(roomId, { username })`,
  same persistence/navigation.

### Lobby (`/lobby`)

`src/screens/Lobby.tsx` shows the room code, player list, and a game
picker. The picker fetches `GET /api/games` to enumerate registered games;
the host can pick one (sends `MSG.SELECT_GAME`) and start (`MSG.START_GAME`).
Non-host players see the current selection but can't change it.

Routes itself to `/game` when `state.phase` becomes `"in-game"` or
`"post-game"`. Routes back to `/` when there's no room.

### GameView (`/game`)

`src/screens/GameView.tsx` looks up the active game in the client registry
by `state.selectedGameId` and mounts its `Component`. If no module matches
the selected game id (shouldn't normally happen), it shows a placeholder
with a host-only "Back to lobby" button.

Routes back to `/lobby` if `phase` is anything other than `in-game` or
`post-game`.

## State snapshot hooks

Colyseus' `room.state` is a reactive proxy backed by the schema. Components
shouldn't read it directly because:

1. Fields can be undefined for a frame between `create()` resolving and
   the first patch arriving.
2. Mutations don't change object identity, so React wouldn't see them.

The pattern in this codebase is one hook per state surface:

- `useLobbyState()` for the top-level `LobbyState`. Returns a `LobbySnapshot`
  plain object or `null` if the schema isn't ready yet.
- `useSHState(room)` for the Secret Hitler nested state. Returns an
  `SHSnapshot` or `null`.

Each hook:

1. Initialises with a defensive snapshot (returns `null` if the live
   schema's relevant field is undefined).
2. Subscribes to `room.onStateChange` and re-runs the snapshot on every
   patch.
3. Cleans up its subscription on unmount.

The lazy-init form `useState(() => snapshot(...))` is used so the
initialiser only runs once on mount.

## Assets

Static files (logos, card textures, role icons) live next to the code
that uses them and are pulled in with `import` so Vite can hash and
validate them:

- `packages/client/src/assets/` — app-shell visuals (the lobby logo).
- `packages/client/src/games/<id>/assets/` — per-game art.

The repo-root `assets/` folder holds design originals; consumed copies
are dropped into the appropriate package folder. See
[assets.md](assets.md) for the full convention.

## Responsive layout

The UI uses one component tree with CSS-driven responsive behaviour — no
device sniffing, no separate mobile bundle. The breakpoint is
`max-width: 899px` for game layouts and `max-width: 720px` for the
lobby.

**Desktop** (≥ 900px): CSS Grid with named template areas. For Secret
Hitler that's a three-column layout: `players | board + role + actions
| log`.

**Mobile** (< 900px portrait): the same sections stack vertically inside
a scrollable column, and the `ActionPanel` is lifted to
`position: fixed; bottom: 0` so it stays in thumb reach as a bottom
sheet (the Hearthstone / Among Us pattern). Bottom padding on the
content column reserves space so nothing scrolls under the sheet.

Other mobile considerations baked into `styles.css`:

- All interactive controls have `min-height: 44px` (Apple HIG tap
  target) and `touch-action: manipulation` to suppress double-tap zoom.
- Inputs use `font-size: 16px` so iOS doesn't auto-zoom on focus.
- Layout heights use `100dvh` (dynamic viewport height) where supported
  so the URL bar showing/hiding doesn't cause re-layout jumps.
- Safe-area insets (`env(safe-area-inset-bottom)`) pad the sticky
  bottom sheet on notched devices.
- `overscroll-behavior-y: none` on `body` prevents page-bounce
  fighting the bottom sheet on iOS.

## Secret Hitler UI

The SH module composes a small set of plain-React components — no
canvas, no 3D. Each lives in `src/games/secret-hitler/ui/`:

| Component         | Role |
|-------------------|------|
| `Header`          | Phase label, policy counts, election-tracker count, deck counts, current President / Chancellor, host-only "Cancel game" button. |
| `Board`           | 2D board: liberal track (5 card slots), fascist track (6 card slots), election-tracker pips, draw/discard counts. Pure CSS — slots are `aspect-ratio: 5/7` rectangles that fill in as policies are enacted. |
| `PlayerList`      | One row per seat with badges: President (P), Chancellor (C), voted, investigated, dead (✕), offline, plus revealed/known role. |
| `ActionPanel`     | Phase-driven action UI: nomination picker, Ja/Nein vote buttons, policy cards, executive-power pickers, peek result, veto prompt. Empty (and hidden) when there's nothing for any player to do. |
| `PrivateRoleCard` | Your role, known allies, and the last investigate result. Only rendered when the server has sent your role. |
| `GameLog`         | Scrolling log of public events. Mirrors `state.gameLog`. |
| `GameOverPanel`   | Winner, reason, and host-only "Play again" / "Back to lobby" buttons. Rendered as a centered floating card when `gamePhase === "game-over"`. |

The `Board` is intentionally information-equivalent to the header
counts — the counts give you the number, the board gives you the
spatial intuition. We could remove one or the other; keeping both
matches the physical game's affordances.

## Client game registry

`src/games/registry.ts`:

```ts
interface ClientGameModule {
  descriptor: GameDescriptor;
  Component: ComponentType<{ room: Room }>;
  setupRoomHandlers?: (room: Room) => void;
}
```

`setupRoomHandlers(room)` is called by `roomStore.setRoom` the moment a
room is accepted, before the `GameView` mounts. Each game uses it to
register `room.onMessage(...)` handlers for its private message types.

## Private info store (per game)

Hidden information the server pushes via `client.send(...)` is held in a
zustand store, not in any Colyseus schema. For Secret Hitler that's
`src/games/secret-hitler/privateInfo.ts`:

```ts
interface PrivateInfoState {
  role: Role | null;
  knownAllies: Ally[];
  presidentHand: Policy[] | null;
  chancellorHand: Policy[] | null;
  peekResult: Policy[] | null;
  investigateResult: { targetSessionId; party } | null;
  // plus setters and a reset()
}
```

The SH module's `setupRoomHandlers` writes incoming messages into this
store via `usePrivateInfo.getState().setRole(...)` etc. Components read
from it with the standard hook.

`SecretHitlerGame.tsx` resets the store on unmount so role / hand info
doesn't leak across games.
