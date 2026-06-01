# Server internals

`packages/server` is a single Node process that owns:

1. The authoritative game state for every active room (via Colyseus).
2. A small HTTP API for non-WebSocket endpoints.
3. Static-serving the built client bundle in production.

All three run on the same port (default `2567`, override via `PORT`).

## Entry point: `src/index.ts`

The bootstrap is intentionally minimal:

- Creates an Express app with two HTTP endpoints (`GET /api/games`,
  `GET /api/rooms/:shortcode`) and a catch-all that serves
  `index.html` for the client SPA.
- Wraps the Express app in `node:http` and attaches a Colyseus `Server`
  with a `WebSocketTransport` bound to the same HTTP server.
- Registers exactly one room handler: `tabletop-games`, implemented by
  `TabletopRoom`.
- Imports concrete game modules for their registration side effects
  (`import "./games/secret-hitler/index.js";`). The act of importing the
  module calls `registerGame(...)` and adds it to the in-memory registry.

The `CLIENT_DIST` env var lets the runtime point at a different
client-bundle directory (defaults to `../client/dist` relative to the
compiled server entry, which matches the Docker layout).

## `TabletopRoom`

`packages/server/src/rooms/TabletopRoom.ts` is the only Colyseus room type.

### State

`this.state` is always a `LobbyState`. When a game is in progress, the
game-specific nested field (`secretHitler` for SH, etc.) is populated and
`state.phase === "in-game"`. When the host returns to the lobby, the field
is cleared and `phase` flips back to `"lobby"`. Game-over leaves the field
populated and sets `phase = "post-game"` so the result UI stays visible.

### Lifecycle

| Hook        | Behaviour |
|-------------|-----------|
| `onCreate`  | Builds initial `LobbyState`. Generates a 4-character shortcode (`A-Z` minus ambiguous letters + `2-9`), stores it both on state and in `room.setMetadata`. Registers all message handlers. |
| `onJoin`    | Adds a `PlayerSchema` to `state.players`. First joiner becomes the host. Throws if `phase === "in-game"` so mid-game joins are rejected. |
| `onLeave`   | Marks the player offline (`connected = false`). If `consented`, immediately removes the player (or, mid-game, hands off to the `GameInstance` to record an elimination). If unconsented, `await this.allowReconnection(client, 60)`: on success, mark reconnected and call `game.onPlayerRejoin`; on timeout, run the same removal/elimination path as a consented leave. Host badge stays put during the reconnect window — it only moves once the seat is actually removed (or the game records an elimination), so a flaky network doesn't churn the host. |
| `onDispose` | Disposes the active `GameInstance`. |

### Message handlers

The room handles a small set of lobby-level messages, and routes everything
else to the active game:

| Message               | Who               | Effect |
|-----------------------|-------------------|--------|
| `SELECT_GAME`         | Host only         | Sets `state.selectedGameId`. Only valid in `lobby` or `post-game`. |
| `START_GAME`          | Host only         | Looks up the registered server module by `selectedGameId`, instantiates a fresh `GameInstance`, and calls `game.onStart()`. The instance flips `state.phase = "in-game"` and populates its nested state field. |
| `RESTART_GAME`        | Host only, post-game | Same as `START_GAME`, but only allowed when `phase === "post-game"`. |
| `RETURN_TO_LOBBY`     | Host only         | Disposes the game, clears the nested state field, sets `phase = "lobby"`. |
| `APPOINT_HOST`        | Host only         | Hands the host badge to another *connected* player. |
| `KICK_PLAYER`         | Host only, lobby/post-game | Removes the target seat and force-disconnects them with WS close code `LEAVE_CODE_KICKED` (4000). The client checks this code in its `room.onLeave` handler to clear its persisted session so it doesn't reconnect-loop on a stale token. Blocked while `phase === "in-game"` to avoid unwinding live game state. |
| `CHAT`                | Anyone in the room | Broadcasts `{ sessionId, username, text, at }` via `room.broadcast(MSG.CHAT, ...)`. Not persisted in state. |
| `GAME_ACTION`         | Anyone (validated by game) | Forwards `{ type, data }` to `game.onMessage(client, type, data)`. |

The host check is by `sessionId` against `state.hostSessionId`. If the host
leaves, the next remaining player becomes host (see `removePlayer`).

## The server game registry

`packages/server/src/games/registry.ts`:

```ts
const games = new Map<string, ServerGameModule>();
export function registerGame(module: ServerGameModule): void;
export function getGame(id: string): ServerGameModule | undefined;
export function listGames(): GameDescriptor[];
```

`ServerGameModule` is `{ descriptor, create(room) }`. The factory returns a
`GameInstance`. Concrete game modules call `registerGame(...)` at import
time. `src/index.ts` triggers registration by importing each game's
`index.ts` for its side effect.

`GET /api/games` returns `listGames()` so the client lobby's game picker
stays in sync with whatever the server has registered.

## The `GameInstance` contract

```ts
interface GameInstance {
  onStart(): void | Promise<void>;
  onMessage(client: Client, type: string, payload: unknown): void;
  onPlayerDisconnect?(client: Client): void; // optional
  onPlayerLeave(client: Client, consented: boolean): void;
  onPlayerRejoin(client: Client): void;
  dispose(): void;
}
```

The optional `onPlayerDisconnect` fires the moment a WebSocket drops
(before the reconnect window starts). Use it to mirror offline state
into the game's per-player schema so the in-game UI can gray the seat
out and tick a kick countdown — but don't eliminate yet; that's
`onPlayerLeave`'s job after the window expires. The base
`PlayerSchema.disconnectedAt` (epoch ms) is set by `TabletopRoom` and
re-stamped by games that want to mirror it onto their own player rows.
The reconnect window length is exported as
`RECONNECT_SECONDS` from `@tabletop-games/shared` so the client can
render countdowns without hard-coding the duration.

A game instance owns:

- The nested Colyseus state for that game (mutates it directly; clients
  receive the patches automatically).
- Game-private state that should never reach the client (e.g. the actual
  card identities in the draw and discard piles, the role-per-player map).
  Private info that does need to reach a specific client is sent via
  `client.send(messageType, payload)`.
- Validation of all incoming `GAME_ACTION` messages (whose turn, what
  phase, whether the target is valid, etc.). Invalid messages are silently
  ignored.

See [games/secret-hitler.md](games/secret-hitler.md) for a worked example.

## Shortcodes and the lookup endpoint

Colyseus' room ids are long, opaque strings. To let users share a
4-character code, every room stores a shortcode in its metadata
(`await this.setMetadata({ shortcode })`).

`GET /api/rooms/:shortcode` queries `matchMaker.query({ name: "tabletop-games" })`,
finds the matching room, and returns its `roomId`. The client uses that to
call `client.joinById(roomId, { username })`.

This is in-memory across the running process. If Colyseus is ever scaled
horizontally we'd add a presence/driver-backed shortcode index.

## Reconnection

`allowReconnection(client, 60)` returns a promise that resolves when the
same client (identified by Colyseus' `reconnectionToken`) reconnects within
60 seconds, and rejects on timeout. The room handles both branches in
`onLeave`'s `try/catch`.

The client stores `room.reconnectionToken` in `localStorage` and calls
`client.reconnect(token)` on app boot. See `docs/architecture.md` for the
full flow.

## Express endpoints

| Path                          | Method | Purpose |
|-------------------------------|--------|---------|
| `/api/games`                  | GET    | List registered game descriptors. |
| `/api/rooms/:shortcode`       | GET    | Resolve shortcode to `roomId`. 404 if unknown. |
| `/matchmake/*`                | (Colyseus) | Standard Colyseus matchmaking endpoints. |
| `/colyseus`                   | GET    | Colyseus monitor dashboard. Mounted only when `NODE_ENV !== "production"`. |
| `/playground`                 | GET    | Colyseus playground — interactive room tester. Mounted only when `NODE_ENV !== "production"`; the `@colyseus/playground` package is loaded via dynamic `import()` so it stays out of production bundles. |
| `*` (anything else)           | GET    | Static client bundle, then `index.html` for SPA fallback. |

## Express 5 wildcard note

The catch-all uses the Express 5 named-splat syntax: `app.get("/*splat", ...)`.
The bare `"*"` form was removed in Express 5 (path-to-regexp v6).
