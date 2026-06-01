import { Schema, type } from "@colyseus/schema";

/**
 * How long (seconds) a dropped client has to reconnect before they are
 * treated as having left the room. Exposed via shared so the client can
 * render a kick countdown without hard-coding the window length.
 */
export const RECONNECT_SECONDS = 60;

export class PlayerSchema extends Schema {
  @type("string") sessionId: string = "";
  @type("string") username: string = "";
  @type("boolean") connected: boolean = true;
  /** Server-side epoch ms when the WebSocket dropped. 0 while connected. */
  @type("number") disconnectedAt: number = 0;
}
