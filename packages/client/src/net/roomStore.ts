import { Room } from "colyseus.js";
import { create } from "zustand";
import type { LobbyState } from "@tabletop-games/shared";

/**
 * A single Colyseus room is held in a Zustand store so any component can read
 * it without prop-drilling. Components that want reactive state should call
 * `useLobbyState()` which subscribes to state-change events.
 */
interface RoomStore {
  room: Room<LobbyState> | null;
  setRoom: (room: Room<LobbyState> | null) => void;
}

export const useRoomStore = create<RoomStore>((set) => ({
  room: null,
  setRoom: (room) => set({ room }),
}));
