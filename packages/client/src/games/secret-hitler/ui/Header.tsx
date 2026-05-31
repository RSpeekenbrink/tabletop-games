import type { SHSnapshot } from "../useSHState.js";

const PHASE_LABEL: Record<string, string> = {
  night: "Night",
  nomination: "Nomination",
  election: "Election",
  "legislative-president": "Legislative — President",
  "legislative-chancellor": "Legislative — Chancellor",
  "veto-response": "Veto response",
  "executive-action": "Executive action",
  "game-over": "Game over",
};

export function Header({ state }: { state: SHSnapshot }) {
  const pres = state.players.find((p) => p.sessionId === state.presidentSessionId);
  const chan =
    state.players.find((p) => p.sessionId === state.chancellorSessionId) ??
    state.players.find((p) => p.sessionId === state.chancellorNomineeSessionId);
  return (
    <div className="sh-header">
      <div className="sh-phase">{PHASE_LABEL[state.gamePhase] ?? state.gamePhase}</div>
      <div className="sh-counts">
        <span className="sh-count liberal">Liberal {state.liberalPolicies}/5</span>
        <span className="sh-count fascist">Fascist {state.fascistPolicies}/6</span>
        <span className="sh-count tracker">Tracker {state.electionTracker}/3</span>
        <span className="sh-count">Draw {state.drawPileCount} · Discard {state.discardPileCount}</span>
        {state.vetoUnlocked && <span className="sh-count">Veto unlocked</span>}
      </div>
      <div className="sh-roles">
        {pres && (
          <span>
            President: <b>{pres.username}</b>
          </span>
        )}
        {chan && (
          <span>
            Chancellor: <b>{chan.username}</b>
          </span>
        )}
      </div>
    </div>
  );
}
