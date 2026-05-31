import type { GameDescriptor } from "@tabletop-games/shared";
import type { ServerGameModule } from "./GameInstance.js";

/**
 * Server-side registry of available games.
 *
 * In Phase 1 this is empty. A game adds itself by importing this module and
 * calling `registerGame(module)` from its own index file (which is then
 * imported once at boot to wire it in). See Phase 2 (Secret Hitler) for the
 * first concrete example.
 */
const games = new Map<string, ServerGameModule>();

export function registerGame(module: ServerGameModule): void {
  if (games.has(module.descriptor.id)) {
    throw new Error(`Game already registered: ${module.descriptor.id}`);
  }
  games.set(module.descriptor.id, module);
}

export function getGame(id: string): ServerGameModule | undefined {
  return games.get(id);
}

export function listGames(): GameDescriptor[] {
  return Array.from(games.values()).map((g) => g.descriptor);
}
