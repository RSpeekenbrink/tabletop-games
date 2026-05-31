import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";

/**
 * Top-level state shared with every connected client.
 *
 * `phase` drives the client routing between the lobby UI and the active game's
 * view. When `phase === "in-game"`, `selectedGameId` identifies which game
 * module's client component should be mounted.
 *
 * Game-specific state lives on the server-side GameInstance and is exposed
 * by attaching its own schema as a nested field (added when a concrete game
 * registers itself).
 */
export class LobbyState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type("string") hostSessionId: string = "";
  @type("string") selectedGameId: string = "";
  @type("string") phase: string = "lobby";
  @type("string") shortcode: string = "";
}
