import { Server, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { monitor } from "@colyseus/monitor";
import express from "express";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { TabletopRoom } from "./rooms/TabletopRoom.js";
import { listGames } from "./games/registry.js";

const PORT = Number(process.env.PORT ?? 2567);
const CLIENT_DIST = process.env.CLIENT_DIST
  ? path.resolve(process.env.CLIENT_DIST)
  : path.resolve(fileURLToPath(new URL("../../client/dist", import.meta.url)));

const app = express();
app.use(express.json());

// Public API: list available games. The client uses this to populate
// the host's game picker. Returning descriptors (not module refs) keeps
// the boundary clean.
app.get("/api/games", (_req, res) => {
  res.json(listGames());
});

// Resolve a human-friendly shortcode -> the real Colyseus roomId.
// Colyseus room ids are long random strings; we store a 4-char shortcode
// in room metadata for users to share.
app.get("/api/rooms/:shortcode", async (req, res) => {
  const shortcode = req.params.shortcode.toUpperCase();
  const rooms = await matchMaker.query({ name: "tabletop-games" });
  const match = rooms.find((r) => r.metadata?.shortcode === shortcode);
  if (!match) {
    res.status(404).json({ error: "Room not found" });
    return;
  }
  res.json({ roomId: match.roomId, shortcode });
});

// Dev-only Colyseus monitor at /colyseus
if (process.env.NODE_ENV !== "production") {
  app.use("/colyseus", monitor());
}

// Serve the built client. In production the Dockerfile copies the client dist
// next to the server dist; in dev, CLIENT_DIST may not exist (Vite serves it).
app.use(express.static(CLIENT_DIST));
app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/matchmake") || req.path.startsWith("/colyseus")) {
    return next();
  }
  res.sendFile(path.join(CLIENT_DIST, "index.html"), (err) => {
    if (err) next();
  });
});

const httpServer = createServer(app);
const gameServer = new Server({
  transport: new WebSocketTransport({ server: httpServer }),
});

gameServer.define("tabletop-games", TabletopRoom);

gameServer.listen(PORT).then(() => {
  console.log(`[tabletop-games] listening on http://localhost:${PORT}`);
});
