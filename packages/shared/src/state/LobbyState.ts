import { MapSchema, Schema, type } from "@colyseus/schema";
import { PlayerSchema } from "./PlayerSchema.js";
import { SecretHitlerState } from "../games/secret-hitler/state.js";

/**
 * Top-level state shared with every connected client.
 *
 * `phase` drives client routing between Lobby and GameView. When a game is
 * active, the corresponding nested field (e.g. `secretHitler`) is populated;
 * when in the lobby, all game fields are undefined.
 *
 * Adding a new game means defining its own Schema and adding one optional
 * field here. Colyseus needs the @type to know about the class at room
 * creation time, so we can't add nested schemas truly dynamically.
 */
export class LobbyState extends Schema {
  @type({ map: PlayerSchema }) players = new MapSchema<PlayerSchema>();
  @type("string") hostSessionId: string = "";
  @type("string") selectedGameId: string = "";
  @type("string") phase: string = "lobby";
  @type("string") shortcode: string = "";

  @type(SecretHitlerState) secretHitler?: SecretHitlerState;
}
