# Documentation

Technical documentation for the Tabletop Games platform.

## Contents

- [Architecture](architecture.md) - High-level overview of how the system fits
  together: monorepo layout, what the server is responsible for, what the
  client is responsible for, and how the two communicate.
- [Server internals](server.md) - Colyseus + Express, the `TabletopRoom`, the
  server-side game registry, reconnection, and HTTP endpoints.
- [Client internals](client.md) - React + Vite + react-three-fiber, screen
  routing, the Colyseus client wrapper, the room store, and the client-side
  game registry.
- [Adding a game](adding-a-game.md) - How to wire a new game into the
  platform. Each game lives in three sibling folders (shared/server/client)
  and registers itself in two registries.
- [Assets](assets.md) - Where images, textures, and other static files
  live; how the client imports them; per-game asset conventions.
- [Operations](operations.md) - Running locally, the Docker image, ports,
  environment variables, and reverse-proxy notes for production.
- [Games](games/) - Per-game rules and implementation notes.
  - [Secret Hitler](games/secret-hitler.md) - Full ruleset and how each rule
    maps onto the server code.

## How to read this

Start with [architecture.md](architecture.md) for the big picture. Then dip
into [server.md](server.md), [client.md](client.md), or
[adding-a-game.md](adding-a-game.md) depending on what you want to do. The
[games/](games/) docs document one game each: read these to understand
the rules a particular game enforces, or as a reference when adding a new
game.
