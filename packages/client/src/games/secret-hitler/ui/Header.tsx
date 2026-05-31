import type { Room } from "colyseus.js";
import { MSG } from "@tabletop-games/shared";
import type { SHSnapshot } from "../useSHState.js";

const PHASE_LABEL: Record<string, string> = {
  night: "Night",
  nomination: "Nomination",
  election: "Election",
  "legislative-president": "Legislative - President",
  "legislative-chancellor": "Legislative - Chancellor",
  "veto-response": "Veto response",
  "executive-action": "Executive action",
  "game-over": "Game over",
};

interface Props {
  state: SHSnapshot;
  room: Room;
  mySessionId: string;
}

export function Header({ state, room, mySessionId }: Props) {
  const pres = state.players.find((p) => p.sessionId === state.presidentSessionId);
  const chan =
    state.players.find((p) => p.sessionId === state.chancellorSessionId) ??
    state.players.find((p) => p.sessionId === state.chancellorNomineeSessionId);
  const isHost = state.hostSessionId === mySessionId;
  const canCancel = isHost && state.gamePhase !== "game-over";

  const onCancel = () => {
    if (!window.confirm("Cancel the current game and return everyone to the lobby?")) return;
    room.send(MSG.RETURN_TO_LOBBY, {});
  };

  return (
    <div className="sh-header">
      <div className="sh-phase">{PHASE_LABEL[state.gamePhase] ?? state.gamePhase}</div>
      <div className="sh-counts">
        <span className="sh-count liberal">Liberal {state.liberalPolicies}/5</span>
        <span className="sh-count fascist">Fascist {state.fascistPolicies}/6</span>
        <span className="sh-count tracker">Tracker {state.electionTracker}/3</span>
        <span className="sh-count">
          Draw {state.drawPileCount} · Discard {state.discardPileCount}
        </span>
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
        {canCancel && (
          <button className="sh-cancel" onClick={onCancel} title="Host: end this game and return everyone to the lobby">
            Cancel game
          </button>
        )}
      </div>
    </div>
  );
}
