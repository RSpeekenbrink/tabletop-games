import { useEffect } from "react";
import type { Room } from "colyseus.js";
import { useSHState } from "./useSHState.js";
import { usePrivateInfo } from "./privateInfo.js";
import { Header } from "./ui/Header.js";
import { Board } from "./ui/Board.js";
import { PlayerList } from "./ui/PlayerList.js";
import { ActionPanel } from "./ui/ActionPanel.js";
import { GameLog } from "./ui/GameLog.js";
import { PrivateRoleCard } from "./ui/PrivateRoleCard.js";
import { GameOverPanel } from "./ui/GameOverPanel.js";

export function SecretHitlerGame({ room }: { room: Room }) {
  const state = useSHState(room);

  useEffect(() => {
    return () => usePrivateInfo.getState().reset();
  }, []);

  if (!state) return null;

  return (
    <div className="sh-game">
      <Header state={state} room={room} mySessionId={room.sessionId} />
      <main className="sh-content">
        <section className="sh-section sh-section-board">
          <Board state={state} />
        </section>
        <section className="sh-section sh-section-players">
          <PlayerList state={state} mySessionId={room.sessionId} />
        </section>
        <section className="sh-section sh-section-log">
          <GameLog state={state} />
        </section>
        <section className="sh-section sh-section-role">
          <PrivateRoleCard state={state} />
        </section>
      </main>
      <div className="sh-actions">
        <ActionPanel state={state} room={room} mySessionId={room.sessionId} />
      </div>
      {state.gamePhase === "game-over" && (
        <GameOverPanel state={state} room={room} mySessionId={room.sessionId} />
      )}
    </div>
  );
}
