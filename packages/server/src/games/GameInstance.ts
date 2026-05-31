import type { Client } from "@colyseus/core";
import type { TabletopRoom } from "../rooms/TabletopRoom.js";

/**
 * A GameInstance is created by a ServerGameModule's factory when the host
 * starts a game. The TabletopRoom delegates game-scoped concerns to it.
 *
 * The instance is responsible for installing its own Colyseus state (e.g. via
 * room.state.gameState = new MyGameState()) and validating all player actions.
 */
export interface GameInstance {
  onStart(): void | Promise<void>;
  onMessage(client: Client, type: string, payload: unknown): void;
  onPlayerLeave(client: Client, consented: boolean): void;
  onPlayerRejoin(client: Client): void;
  dispose(): void;
}

export interface ServerGameModule {
  descriptor: import("@tabletop-games/shared").GameDescriptor;
  create(room: TabletopRoom): GameInstance;
}
