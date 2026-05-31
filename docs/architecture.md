# Architecture

A browser-based, multiplayer tabletop platform with a pluggable game registry.
The server is authoritative; the client is a thin renderer.

## Diagram

```
                    Browser (one per player)
        ┌─────────────────────────────────────────────────┐
        │  React (Vite) + react-three-fiber + drei        │
        │  Screens: Landing / Lobby / GameView            │
        │  Client game registry: Component per game       │
        │  Private info store (zustand): role, hand, peek │
        └───────────────────┬─────────────────────────────┘
                            │ Colyseus protocol over WebSocket
                            │ (state patches + typed messages)
                            ▼
        ┌─────────────────────────────────────────────────┐
        │  Node + Express + Colyseus                      │
        │  TabletopRoom (lobby + delegation)              │
        │  Server game registry: GameInstance per game    │
        │  Schema: LobbyState (root) + nested game state  │
        └─────────────────────────────────────────────────┘
```

## Monorepo layout

```
tabletop-games/
├── packages/
│   ├── shared/   # Pure TS + @colyseus/schema. Types, message constants,
│   │             # schemas. Imported by both server and client.
│   ├── server/   # Node + Express + Colyseus. Static-serves the client.
│   └── client/   # React + Vite + react-three-fiber.
├── Dockerfile    # Multi-stage: build all → runtime image serves both.
├── docker-compose.yml
└── tsconfig.base.json
```

npm workspaces handle dependency hoisting and symlinking. `@tabletop-games/shared`
is consumed by `@tabletop-games/server` and `@tabletop-games/client` via a
workspace symlink (compiled output, not source).

## What lives where

### `packages/shared`

The wire contract. Anything that crosses the network is defined here:

- **Colyseus `Schema` classes.** `LobbyState`, `PlayerSchema`, plus a nested
  schema per game (e.g. `SecretHitlerState`, `SHPlayer`). The root schema is
  fixed at room creation, so each game's schema is declared as an optional
  nested field on `LobbyState` (`@type(SecretHitlerState) secretHitler?`).
  See [server.md](server.md) for why we don't swap the root state.
- **Message type constants.** Top-level lobby actions (`MSG.SELECT_GAME`,
  `MSG.START_GAME`, ...) and per-game actions (`SH_ACTION.NOMINATE_CHANCELLOR`,
  ...). Stored as `const` objects so server and client agree on the strings.
- **TypeScript payload interfaces** for each message.
- **Game descriptors** (`{ id, name, minPlayers, maxPlayers }`) used by both
  registries.

No runtime code beyond schema construction.

### `packages/server`

The authoritative game state and rules:

- **`TabletopRoom`.** One room type for the whole platform. Handles join,
  leave, reconnection, the host concept, chat, game selection, and
  delegation of in-game messages to a `GameInstance`.
- **Server game registry.** A `Map<id, ServerGameModule>` keyed by game id.
  Each module has a factory `create(room)` returning a `GameInstance`.
- **`GameInstance` per game.** Owns the game's state machine: phase
  transitions, action validation, deck handling, private message sending
  (`client.send(...)` for hidden info).
- **HTTP API.** Tiny Express app for the few non-WS endpoints
  (`GET /api/games`, `GET /api/rooms/:shortcode`) and to static-serve the
  built client bundle from the same port.

### `packages/client`

A React app with a 3D scene and 2D overlay:

- **Routing.** Three screens (Landing, Lobby, GameView). Navigation is driven
  by `state.phase`: `lobby` shows Lobby, `in-game` or `post-game` shows
  GameView, anything else routes back to Landing.
- **Colyseus client.** A singleton `Client` connected to the same origin in
  production (Vite proxies in dev). The active `Room` lives in a zustand
  store (`useRoomStore`) so any component can read it.
- **State snapshots.** Hooks like `useLobbyState` and `useSHState` convert
  the live Colyseus schema into a plain object snapshot on each state-change
  event, so React's referential comparison sees a new value each tick.
- **Client game registry.** Each game registers a React `Component` that
  renders the in-game UI, and optionally `setupRoomHandlers(room)` to
  register private-message listeners (so messages aren't dropped before the
  component mounts).
- **Private info store.** Per-game zustand store (`usePrivateInfo` for SH)
  that holds hidden info the server pushed to this client (role, hands, peek
  results, investigate results). Not part of the Colyseus schema.

## Communication model

Two distinct channels travel over the same WebSocket:

| Channel             | What                                          | Visibility   |
|---------------------|-----------------------------------------------|--------------|
| State patches       | Schema-encoded diffs of the room state        | Everyone in the room |
| Typed messages      | `room.send(type, payload)` / `client.send(...)` | Per-recipient |

State patches are broadcast to every client and serialized via Colyseus'
binary protocol. They carry **public** game state - things every player can
see (current phase, policy counts, who is President, who has voted, etc.).

Typed messages are used for two cases:

1. **Action requests from clients.** E.g. the President sending
   `MSG.GAME_ACTION` with a `{ type: "sh.nominate_chancellor", data: ... }`
   payload. The server validates and mutates state.
2. **Hidden information from the server.** E.g. each player's role, the
   President's three-card hand, the peek result. Sent with `client.send(...)`
   so only the targeted client receives it. These never go through the
   schema, so no other client can see them.

This split is the core security boundary: anything in the schema is public,
anything sent via typed messages is per-recipient.

## State swapping (and why we don't)

The first instinct when starting a game is "swap the room's root state to
the game's schema". Colyseus 0.16's wire protocol fixes the root schema at
join time, so swapping it via `this.state = new SHState()` breaks the
connected clients (they get "field not defined" deserialization errors).

Instead, each game's state is an optional nested field on `LobbyState`.
When the host starts a game, the `GameInstance` populates
`root.secretHitler = new SecretHitlerState(...)` and flips
`root.phase = "in-game"`. The client routes on `phase` and reads the nested
field. On return-to-lobby the field is cleared (`root.secretHitler = undefined`).

The cost is that `LobbyState` declares one `@type` field per game. That's
explicit and a small price for predictable behaviour. See
[adding-a-game.md](adding-a-game.md).

## Reconnection

Colyseus' built-in reconnection is used end to end:

- On every successful `create` / `joinById` / `reconnect`, the client
  persists `{ roomId, reconnectionToken, username }` to `localStorage` under
  `tabletop-games:session`.
- On app boot, if a session exists, the client calls
  `client.reconnect(token)`. On success, route to the lobby or game view
  based on the current `state.phase`. On failure, clear the session.
- Server-side, `TabletopRoom.onLeave(client, consented)` calls
  `await this.allowReconnection(client, 60)` for unconsented disconnects.
  If the client reconnects within 60s, the seat is restored; otherwise the
  in-game instance is told to eliminate the player.

Mid-game reconnect also re-sends private state (your role, your hand if you
were holding one) via `onPlayerRejoin`.

## Single Docker image

In production the same Node process serves the Colyseus WebSocket, the
small HTTP API, and the Vite-built static client bundle on one port.
See [operations.md](operations.md).
