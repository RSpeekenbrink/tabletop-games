# Operations

How to run the platform locally, build a production image, deploy behind a
reverse proxy, and what knobs to tweak.

## Local development

```bash
npm install
npm run dev
```

`npm run dev` starts three things in parallel:

| Workspace                  | Port | Notes                                               |
|----------------------------|------|-----------------------------------------------------|
| `@tabletop-games/shared`   | n/a  | `tsc --watch` so the server picks up schema changes |
| `@tabletop-games/server`   | 2567 | Colyseus + Express, hot-reloaded with `tsx watch`   |
| `@tabletop-games/client`   | 5173 | Vite dev server                                     |

Vite proxies `/api`, `/matchmake`, and `/colyseus` to `http://localhost:2567`
so a single origin works from the browser at <http://localhost:5173>.

In dev, the Colyseus monitor dashboard is mounted at
<http://localhost:2567/colyseus> (only when `NODE_ENV !== "production"`).

## Production build

```bash
npm run build
```

This compiles all three workspaces. The server boots from
`packages/server/dist/index.js` and expects the Vite-built client at
`packages/client/dist/` (configurable via `CLIENT_DIST`).

```bash
node packages/server/dist/index.js
```

## Docker

The Dockerfile is a two-stage multi-arch build. One image, one process,
one port:

```bash
npm run docker:build         # docker build -t tabletop-games .
npm run docker:run           # docker run --rm -p 2567:2567 tabletop-games
```

or with compose:

```bash
docker compose up --build
```

### Stages

1. **`build`** (`node:22-alpine`). Copies workspace manifests, runs
   `npm install --workspaces --include-workspace-root`, then copies the
   source and runs `npm run build`.
2. **`runtime`** (`node:22-alpine`). Copies only the prod-needed workspace
   manifests, installs prod deps for `@tabletop-games/shared` and
   `@tabletop-games/server` (the client deps are bundled into the Vite
   output and not needed at runtime), then copies all three `dist/`
   folders. `CMD node packages/server/dist/index.js`.

### Image contents (runtime stage)

- `packages/server/dist/` - compiled server.
- `packages/shared/dist/` - compiled shared types and schemas.
- `packages/client/dist/` - Vite build output served statically.
- `node_modules/` - production-only.

## Environment variables

| Variable      | Default            | Purpose |
|---------------|--------------------|---------|
| `PORT`        | `2567`             | TCP port the HTTP server (which also hosts WebSockets) binds to. |
| `CLIENT_DIST` | `../client/dist`   | Absolute or relative path to the built client bundle. Resolved relative to the compiled server entry. The Docker image leaves this at the default. |
| `NODE_ENV`    | unset              | When `production`, the Colyseus monitor at `/colyseus` is **not** mounted. |
| `VITE_COLYSEUS_URL` | unset       | Build-time only. Override the WebSocket endpoint used by the client. If unset, the client uses `ws[s]://<current host>`. |

## Ports and reverse proxy

The container only exposes `2567` because the Node process listens on a
single port for everything (HTTP API + WebSocket + static client). In
production you typically don't want users hitting `2567` directly:

1. **Map a host port at run time.** Quick local override:
   ```
   docker run -p 80:2567 tabletop-games
   ```
2. **Run a reverse proxy.** Recommended for anything reachable from the
   internet. The proxy listens on 80/443, terminates TLS, and forwards
   both HTTP and WebSocket traffic to `tabletop-games:2567`. Examples:

   - **nginx:**
     ```nginx
     server {
       listen 443 ssl http2;
       server_name tabletop.example.com;

       location / {
         proxy_pass http://tabletop:2567;
         proxy_http_version 1.1;
         proxy_set_header Upgrade $http_upgrade;
         proxy_set_header Connection "upgrade";
         proxy_set_header Host $host;
         proxy_read_timeout 90s;
       }
     }
     ```
   - **Caddy:**
     ```
     tabletop.example.com {
       reverse_proxy tabletop:2567
     }
     ```

The Node process never sees port 443 or terminates TLS. Don't try to bind
Node to ports below 1024 directly - it needs root or
`cap_net_bind_service`, and you'd still want TLS termination upstream.

## Reconnection behaviour

When a client's WebSocket drops (refresh, lost network, sleep), the
server's `TabletopRoom.onLeave` calls `await this.allowReconnection(client, 60)`.

- The client persists `{ roomId, reconnectionToken, username }` in
  `localStorage["tabletop-games:session"]`.
- On the next app boot (or refresh), the client calls
  `colyseusClient.reconnect(token)`. If the server still has the seat
  open, the client re-enters in the same seat with the same `sessionId`.
- If 60 seconds elapse without a reconnect, the seat is released:
  - In the lobby, the player is removed.
  - In a game, the active `GameInstance` is told to eliminate them; the
    game decides what that means (for Secret Hitler, the player is
    marked dead, and if they were Hitler the liberals win).

The 60-second window is hardcoded as `RECONNECT_SECONDS` in
`packages/server/src/rooms/TabletopRoom.ts`.

## Scaling notes

The current setup is single-process and in-memory. That covers a lot of
ground: one Node instance can comfortably handle thousands of concurrent
WebSocket connections.

If you need to scale beyond a single node:

- Colyseus supports presence and matchmaking drivers
  (`@colyseus/redis-presence`, `@colyseus/redis-driver`). Sticky-session
  routing at the load balancer is required because Colyseus rooms are
  bound to a specific process.
- The 4-character shortcode lookup currently uses
  `matchMaker.query({ name: "tabletop-games" })` which is in-memory; with
  multiple processes you'd want this backed by the matchmaking driver
  too.
- Game state is held entirely in memory inside the room. A server
  restart kills active games. Persistence would require serialising
  game state to a store and rehydrating on room recreate.

None of these are required for typical friend-group play sessions.
