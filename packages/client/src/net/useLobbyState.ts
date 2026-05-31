import { useEffect, useState } from "react";
import type { LobbyState } from "@tabletop-games/shared";
import { useRoomStore } from "./roomStore.js";

/**
 * Snapshot of the lobby state, refreshed on every server patch.
 *
 * We re-serialize the relevant fields into a plain object so React's referential
 * comparison sees a new value each tick. For nested game state, individual
 * game UIs subscribe directly to their own schema fields instead.
 */
export interface LobbySnapshot {
  hostSessionId: string;
  selectedGameId: string;
  phase: string;
  shortcode: string;
  players: Array<{ sessionId: string; username: string; connected: boolean }>;
}

function snapshot(state: LobbyState | undefined): LobbySnapshot | null {
  // Colyseus may not have populated the state schema yet on the first read
  // after create()/joinById() — fields like `players` can be undefined for
  // a single frame. Return null so the consumer holds off until the first
  // state-change patch arrives.
  if (!state || !state.players) return null;
  const players: LobbySnapshot["players"] = [];
  state.players.forEach((p) => {
    players.push({ sessionId: p.sessionId, username: p.username, connected: p.connected });
  });
  return {
    hostSessionId: state.hostSessionId ?? "",
    selectedGameId: state.selectedGameId ?? "",
    phase: state.phase ?? "lobby",
    shortcode: state.shortcode ?? "",
    players,
  };
}

export function useLobbyState(): LobbySnapshot | null {
  const room = useRoomStore((s) => s.room);
  const [state, setState] = useState<LobbySnapshot | null>(() =>
    room ? snapshot(room.state) : null,
  );

  useEffect(() => {
    if (!room) {
      setState(null);
      return;
    }
    setState(snapshot(room.state));
    const handler = () => setState(snapshot(room.state));
    room.onStateChange(handler);
    return () => room.onStateChange.remove(handler);
  }, [room]);

  return state;
}
