import { useMemo } from "react";
import type { Room } from "colyseus.js";
import { MSG, SH_ACTION, type Vote } from "@tabletop-games/shared";
import type { SHSnapshot } from "../useSHState.js";

/**
 * Single dispatch path for every Secret Hitler action, shared by the 3D
 * interaction handlers and the HTML prompt strip. Mirrors the payloads the
 * old `ui/ActionPanel.tsx` sent — the server contract is unchanged.
 */
export function useSHActions(room: Room) {
  return useMemo(() => {
    const send = (type: string, data?: unknown) => room.send(MSG.GAME_ACTION, { type, data });
    return {
      nominate: (targetSessionId: string) =>
        send(SH_ACTION.NOMINATE_CHANCELLOR, { targetSessionId }),
      vote: (vote: Vote) => send(SH_ACTION.VOTE, { vote }),
      discardPolicy: (index: number) => send(SH_ACTION.DISCARD_POLICY, { index }),
      enactPolicy: (index: number) => send(SH_ACTION.ENACT_POLICY, { index }),
      proposeVeto: () => send(SH_ACTION.PROPOSE_VETO, {}),
      vetoRespond: (agree: boolean) => send(SH_ACTION.VETO_RESPONSE, { agree }),
      acknowledgePeek: () => send(SH_ACTION.ACKNOWLEDGE_PEEK, {}),
      investigate: (targetSessionId: string) =>
        send(SH_ACTION.INVESTIGATE_PLAYER, { targetSessionId }),
      execute: (targetSessionId: string) => send(SH_ACTION.EXECUTE_PLAYER, { targetSessionId }),
      chooseNextPresident: (targetSessionId: string) =>
        send(SH_ACTION.CHOOSE_NEXT_PRESIDENT, { targetSessionId }),
      returnToLobby: () => room.send(MSG.RETURN_TO_LOBBY, {}),
    };
  }, [room]);
}

export type SHActions = ReturnType<typeof useSHActions>;

/** Players the president may nominate as chancellor (mirrors ActionPanel). */
export function nominationEligible(state: SHSnapshot, mySessionId: string): Set<string> {
  const aliveCount = state.players.filter((p) => p.alive).length;
  const eligible = new Set<string>();
  for (const p of state.players) {
    if (!p.alive || p.sessionId === mySessionId) continue;
    if (p.sessionId === state.lastChancellorSessionId) continue;
    if (aliveCount > 5 && p.sessionId === state.lastPresidentSessionId) continue;
    eligible.add(p.sessionId);
  }
  return eligible;
}

/** Valid targets for the pending executive power (investigate skips already-investigated). */
export function executiveEligible(state: SHSnapshot, mySessionId: string): Set<string> {
  const power = state.pendingExecutivePower;
  const set = new Set<string>();
  for (const p of state.players) {
    if (!p.alive || p.sessionId === mySessionId) continue;
    if (power === "investigate" && p.investigated) continue;
    set.add(p.sessionId);
  }
  return set;
}

/**
 * Which session IDs the local player can currently tap to act on, given the
 * phase. Empty when it isn't the local player's spatial turn.
 */
export function tappableSeats(state: SHSnapshot, mySessionId: string): Set<string> {
  const isPres = mySessionId === state.presidentSessionId;
  if (state.gamePhase === "nomination" && isPres) {
    return nominationEligible(state, mySessionId);
  }
  if (state.gamePhase === "executive-action" && isPres) {
    const power = state.pendingExecutivePower;
    // Investigation is a one-shot: once a target is chosen the result card is
    // shown and the President only needs to acknowledge — no more tapping.
    if (power === "investigate" && state.executivePowerTargetSessionId) {
      return new Set();
    }
    if (power === "investigate" || power === "execute" || power === "special-election") {
      return executiveEligible(state, mySessionId);
    }
  }
  return new Set();
}
