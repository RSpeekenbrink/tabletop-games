import type { GameDescriptor } from "@tabletop-games/shared";
import type { ComponentType } from "react";
import type { Room } from "colyseus.js";

/**
 * Presentation for a game's lobby card (Steam-library style). All fields are
 * optional; the lobby falls back to a generic dark card with the descriptor's
 * name/player counts when a game omits these.
 */
export interface GameCardArt {
  /** URL to a full-bleed background image (imported asset). */
  art?: string;
  /** Short evocative line shown above the player count. */
  tagline?: string;
  /** Hex color used for the selection ring/glow. Defaults to the UI accent. */
  accent?: string;
}

export interface ClientGameModule {
  descriptor: GameDescriptor;
  Component: ComponentType<{ room: Room }>;
  /** Optional lobby-card presentation. */
  card?: GameCardArt;
  /**
   * Optional. Called once as soon as the room becomes available, before the
   * game's UI mounts. Use this to register private-message handlers (e.g.
   * role / hand deliveries) so messages the server sends at game start
   * aren't dropped before the GameView component is rendered.
   */
  setupRoomHandlers?: (room: Room) => void;
}

const games = new Map<string, ClientGameModule>();

export function registerClientGame(module: ClientGameModule): void {
  if (games.has(module.descriptor.id)) {
    throw new Error(`Client game already registered: ${module.descriptor.id}`);
  }
  games.set(module.descriptor.id, module);
}

export function getClientGame(id: string): ClientGameModule | undefined {
  return games.get(id);
}

export function listClientGames(): ClientGameModule[] {
  return Array.from(games.values());
}
