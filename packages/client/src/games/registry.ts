import type { GameDescriptor } from "@tabletop-games/shared";
import type { ComponentType } from "react";
import type { Room } from "colyseus.js";

export interface ClientGameModule {
  descriptor: GameDescriptor;
  Component: ComponentType<{ room: Room }>;
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
