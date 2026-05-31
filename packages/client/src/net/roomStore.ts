import { Room } from "colyseus.js";
import { create } from "zustand";
import type { LobbyState } from "@tabletop-games/shared";
import { listClientGames } from "../games/registry.js";

/**
 * The active Colyseus room. When set, we synchronously register every
 * registered game's private-message handlers on the new room so that
 * messages the server sends at game start (or on rejoin) aren't dropped
 * while React still mounts the GameView component.
 */
interface RoomStore {
  room: Room<LobbyState> | null;
  setRoom: (room: Room<LobbyState> | null) => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  setRoom: (room) => {
    if (room) {
      for (const game of listClientGames()) {
        game.setupRoomHandlers?.(room);
      }
    }
    set({ room });
  },
}));
