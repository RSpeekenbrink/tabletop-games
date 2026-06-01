import { useEffect, useState } from "react";
import { RECONNECT_SECONDS } from "@tabletop-games/shared";
import type { SHSnapshot } from "../useSHState.js";
import { usePrivateInfo } from "../privateInfo.js";
import { Avatar } from "../../../ui/Avatar.js";

interface Props {
  state: SHSnapshot;
  mySessionId: string;
}

export function PlayerList({ state, mySessionId }: Props) {
  const priv = usePrivateInfo();
  const allyRoles = new Map(priv.knownAllies.map((a) => [a.sessionId, a.role]));

  // Only tick a 1s timer while someone is actually in the reconnect window —
  // otherwise the list re-renders for no reason.
  const hasCountdown = state.players.some(
    (p) => p.alive && !p.connected && p.disconnectedAt > 0,
  );
  const now = useTick(hasCountdown);

  return (
    <>
      <h3>Players</h3>
      {state.players.map((p) => {
        const isPres = p.sessionId === state.presidentSessionId;
        const isChanNominee = p.sessionId === state.chancellorNomineeSessionId;
        const isChan = p.sessionId === state.chancellorSessionId;
        const revealedRole = state.revealedRoles.get(p.sessionId);
        const knownRole = allyRoles.get(p.sessionId);
        const myRole = p.sessionId === mySessionId ? priv.role : null;
        const showRole = revealedRole ?? myRole ?? knownRole ?? null;

        const inReconnectWindow = p.alive && !p.connected && p.disconnectedAt > 0;
        const secondsLeft = inReconnectWindow
          ? Math.max(
              0,
              Math.ceil(
                (p.disconnectedAt + RECONNECT_SECONDS * 1000 - now) / 1000,
              ),
            )
          : null;

        const rowClasses = [
          "sh-player-row",
          !p.alive ? "dead" : "",
          inReconnectWindow ? "disconnected" : "",
          p.sessionId === mySessionId ? "self" : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <div key={p.sessionId} className={rowClasses}>
            <span className="player-identity">
              <Avatar seed={p.username} size={28} />
              <span className="sh-player-name">
                {p.username}
                {p.sessionId === mySessionId ? " (you)" : ""}
              </span>
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
              {secondsLeft !== null && (
                <span
                  className="badge kick-countdown"
                  title="Will be kicked if they don't reconnect"
                >
                  {secondsLeft}s
                </span>
              )}
            </span>
          </div>
        );
      })}
    </>
  );
}

function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}
