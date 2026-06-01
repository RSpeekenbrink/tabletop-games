<p align="center">
  <img src="assets/tabletop_games.png" alt="Tabletop Games" width="500" />
</p>

<p align="center">
  A browser-based, multiplayer tabletop simulator with a pluggable game registry.
  React + Three.js on the client, Colyseus on the server, served as a single Docker image.
</p>

---

## Idea

Hosting a tabletop game night online usually means juggling a different site per
game. **Tabletop Games** is a single platform where you create a room, invite
friends, and pick a game from a built-in catalog. Each game is a self-contained
module with its own server logic and 3D scene, so adding a new game means
dropping a folder into the repo, not rewriting the framework.

## How it works

```
                            ┌────────────────────────────────────┐
                            │            Browser (you)           │
                            │  React + Vite + react-three-fiber  │
                            └──────────────────┬─────────────────┘
                                               │ WebSocket
                                               ▼
                            ┌────────────────────────────────────┐
                            │       Colyseus authoritative       │
                            │     TabletopRoom + GameInstance    │
                            └────────────────────────────────────┘
```

- **The server is authoritative.** All game state lives in a Colyseus `Schema`
  on the server; the client receives filtered patches. Hidden information (e.g.
  private hands, secret roles) is never sent to clients who shouldn't see it.
- **One room type, many games.** A single `TabletopRoom` owns the lobby
  (players, host, chat, game selection). When the host starts a game, the room
  instantiates a `GameInstance` from the registry and delegates all in-game
  messages to it. Restart and "switch game" are first-class.
- **Reconnection is free.** A refresh restores the same seat: the client
  persists Colyseus's `reconnectionToken` in `localStorage`, the server holds
  the seat open for 60 seconds via `allowReconnection`.
- **Human-friendly room codes.** Rooms get a 4-character shortcode (e.g.
  `Q7HK`) stored in the room metadata. Joiners hit `GET /api/rooms/:shortcode`
  to resolve it to the internal Colyseus room id.
- **One container.** Production builds the client with Vite and serves the
  static bundle from the same Node process that runs the Colyseus server. One
  image, one port (2567).

## Tech stack

| Layer    | Stack                                                              |
| -------- | ------------------------------------------------------------------ |
| Client   | React 19, Vite, TypeScript, react-three-fiber, drei, colyseus.js   |
| Server   | Node 20, Colyseus 0.16, Express, TypeScript, ws-transport          |
| Shared   | Colyseus `Schema` types + message constants (npm workspace)        |
| Tooling  | npm workspaces, tsx (dev hot-reload), Docker multi-stage build     |

## Project structure

```
tabletop-games/
├── packages/
│   ├── shared/         GameDescriptor, message constants, LobbyState/PlayerSchema
│   ├── server/         Colyseus + Express, TabletopRoom, game registry
│   └── client/         React + Vite + r3f, screens, client-side game registry
├── Dockerfile          multi-stage build + runtime image
├── docker-compose.yml
└── tsconfig.base.json
```

## Running it

### Local development

```bash
npm install
npm run dev
```

This runs three things concurrently:

| Workspace | Port | Notes                                              |
| --------- | ---- | -------------------------------------------------- |
| shared    | n/a  | `tsc --watch`                                      |
| server    | 2567 | Colyseus + Express via `tsx watch`                 |
| client    | 5173 | Vite dev server; proxies `/api`, `/matchmake`, `/colyseus` to 2567 |

Open <http://localhost:5173> and you're in. The Colyseus monitor is available
at <http://localhost:2567/colyseus> when `NODE_ENV !== "production"`.

### Production / Docker

```bash
npm run docker:build
npm run docker:run        # http://localhost:2567
```

The image contains the compiled server and the Vite production bundle. Set
`PORT` to override the listen port.

```bash
docker compose up --build
```

## Adding a new game

Each game lives in three sibling folders, one per workspace:

```
packages/shared/src/games/<game-id>/   message types, schema definitions
packages/server/src/games/<game-id>/   GameInstance implementation + register
packages/client/src/games/<game-id>/   React component + register
```

A game module exports a `GameDescriptor` (id, name, min/max players) and
registers itself in the corresponding registry. The lobby's game picker is
populated from the server registry via `GET /api/games`; the client's
`GameView` mounts the matching client component when the host starts the game.

See [docs/adding-a-game.md](docs/adding-a-game.md) for a step-by-step walkthrough.

## Documentation

Full technical and game-mechanics documentation lives in [docs/](docs/README.md):

- [Architecture](docs/architecture.md)
- [Server internals](docs/server.md)
- [Client internals](docs/client.md)
- [Adding a game](docs/adding-a-game.md)
- [Operations](docs/operations.md) (running locally, Docker, reverse proxy)
- [Secret Hitler](docs/games/secret-hitler.md) (rules + implementation)

## License

This project is licensed under the
[Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International License
(CC BY-NC-SA 4.0)](https://creativecommons.org/licenses/by-nc-sa/4.0/).
See [LICENSE](LICENSE) for the full text.

The Secret Hitler ruleset is a separate work by Mike Boxleiter, Tommy Maranges,
Max Temkin, and Mac Schubert, released under the same license. See
<https://www.secrethitler.com/>.
