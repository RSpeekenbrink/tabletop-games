import type { SHSnapshot } from "../useSHState.js";
import { usePrivateInfo } from "../privateInfo.js";

interface Props {
  state: SHSnapshot;
  mySessionId: string;
}

export function PlayerList({ state, mySessionId }: Props) {
  const priv = usePrivateInfo();
  const allyRoles = new Map(priv.knownAllies.map((a) => [a.sessionId, a.role]));

  return (
    <div className="sh-players">
      <h3>Players</h3>
      {state.players.map((p) => {
        const isPres = p.sessionId === state.presidentSessionId;
        const isChanNominee = p.sessionId === state.chancellorNomineeSessionId;
        const isChan = p.sessionId === state.chancellorSessionId;
        const revealedRole = state.revealedRoles.get(p.sessionId);
        const knownRole = allyRoles.get(p.sessionId);
        const myRole = p.sessionId === mySessionId ? priv.role : null;
        const showRole = revealedRole ?? myRole ?? knownRole ?? null;
        return (
          <div
            key={p.sessionId}
            className={`sh-player-row ${p.alive ? "" : "dead"} ${
              p.sessionId === mySessionId ? "self" : ""
            }`}
          >
            <span className="sh-player-name">
              {p.username}
              {p.sessionId === mySessionId ? " (you)" : ""}
            </span>
            <span className="sh-player-badges">
              {isPres && <span className="badge pres">P</span>}
              {(isChan || isChanNominee) && <span className="badge chan">C</span>}
              {p.votedThisRound && state.gamePhase === "election" && (
                <span className="badge">voted</span>
              )}
              {p.investigated && <span className="badge">inv</span>}
              {showRole && <span className={`badge role-${showRole}`}>{showRole}</span>}
              {!p.alive && <span className="badge offline">✕</span>}
              {!p.connected && p.alive && <span className="badge offline">off</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}
