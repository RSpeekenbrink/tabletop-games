import type { Room } from "colyseus.js";
import { MSG } from "@tabletop-games/shared";
import type { SHSnapshot } from "../useSHState.js";

const REASON_LABEL: Record<string, string> = {
  "five-liberal-policies": "Liberals enacted 5 policies.",
  "six-fascist-policies": "Fascists enacted 6 policies.",
  "hitler-executed": "Hitler was executed.",
  "hitler-elected-chancellor": "Hitler was elected Chancellor with ≥3 fascist policies.",
};

interface Props {
  state: SHSnapshot;
  room: Room;
  mySessionId: string;
}

export function GameOverPanel({ state, room, mySessionId }: Props) {
  const isHost = state.hostSessionId === mySessionId;
  const won = state.winner;
  return (
    <div className="sh-gameover">
      <h2 className={`sh-winner-${won}`}>
        {won === "liberal" ? "Liberals win!" : "Fascists win!"}
      </h2>
      <div className="muted">{REASON_LABEL[state.winReason] ?? state.winReason}</div>
      {isHost && (
        <div className="row" style={{ marginTop: "0.75rem" }}>
          <button onClick={() => room.send(MSG.RESTART_GAME, {})}>Play again</button>
          <button onClick={() => room.send(MSG.RETURN_TO_LOBBY, {})}>Back to lobby</button>
        </div>
      )}
      {!isHost && <div className="muted">Waiting for host…</div>}
    </div>
  );
}
