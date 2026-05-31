import { useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import type { LobbyState } from "@tabletop-games/shared";

export interface SHPlayerView {
  sessionId: string;
  username: string;
  connected: boolean;
  alive: boolean;
  investigated: boolean;
  votedThisRound: boolean;
}

export interface SHSnapshot {
  hostSessionId: string;
  shortcode: string;
  phase: string;
  gamePhase: string;
  liberalPolicies: number;
  fascistPolicies: number;
  electionTracker: number;
  drawPileCount: number;
  discardPileCount: number;
  seatOrder: string[];
  presidentSessionId: string;
  chancellorNomineeSessionId: string;
  chancellorSessionId: string;
  lastPresidentSessionId: string;
  lastChancellorSessionId: string;
  votes: Map<string, string>;
  votesRevealed: boolean;
  vetoUnlocked: boolean;
  vetoProposed: boolean;
  pendingExecutivePower: string;
  executivePowerTargetSessionId: string;
  winner: string;
  winReason: string;
  revealedRoles: Map<string, string>;
  gameLog: string[];
  players: SHPlayerView[];
}

function snapshot(root: LobbyState | undefined): SHSnapshot | null {
  if (!root) return null;
  const sh = root.secretHitler;
  if (!sh || !sh.shPlayers) return null;
  const players: SHPlayerView[] = [];
  sh.shPlayers.forEach((p) => {
    players.push({
      sessionId: p.sessionId,
      username: p.username,
      connected: p.connected,
      alive: p.alive,
      investigated: p.investigated,
      votedThisRound: p.votedThisRound,
    });
  });
  const votes = new Map<string, string>();
  sh.votes?.forEach((v, k) => votes.set(k, v));
  const revealedRoles = new Map<string, string>();
  sh.revealedRoles?.forEach((r, k) => revealedRoles.set(k, r));
  return {
    hostSessionId: root.hostSessionId,
    shortcode: root.shortcode,
    phase: root.phase,
    gamePhase: sh.gamePhase,
    liberalPolicies: sh.liberalPolicies,
    fascistPolicies: sh.fascistPolicies,
    electionTracker: sh.electionTracker,
    drawPileCount: sh.drawPileCount,
    discardPileCount: sh.discardPileCount,
    seatOrder: Array.from(sh.seatOrder),
    presidentSessionId: sh.presidentSessionId,
    chancellorNomineeSessionId: sh.chancellorNomineeSessionId,
    chancellorSessionId: sh.chancellorSessionId,
    lastPresidentSessionId: sh.lastPresidentSessionId,
    lastChancellorSessionId: sh.lastChancellorSessionId,
    votes,
    votesRevealed: sh.votesRevealed,
    vetoUnlocked: sh.vetoUnlocked,
    vetoProposed: sh.vetoProposed,
    pendingExecutivePower: sh.pendingExecutivePower,
    executivePowerTargetSessionId: sh.executivePowerTargetSessionId,
    winner: sh.winner,
    winReason: sh.winReason,
    revealedRoles,
    gameLog: Array.from(sh.gameLog),
    players,
  };
}

export function useSHState(room: Room): SHSnapshot | null {
  const [state, setState] = useState<SHSnapshot | null>(() =>
    snapshot(room.state as LobbyState | undefined),
  );
  useEffect(() => {
    const handler = () => setState(snapshot(room.state as LobbyState | undefined));
    room.onStateChange(handler);
    return () => room.onStateChange.remove(handler);
  }, [room]);
  return state;
}
