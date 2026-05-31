import { useEffect } from "react";
import type { Room } from "colyseus.js";
import { useSHState } from "./useSHState.js";
import { usePrivateInfo } from "./privateInfo.js";
import { SHScene } from "./scene/Scene.js";
import { Header } from "./ui/Header.js";
import { PlayerList } from "./ui/PlayerList.js";
import { ActionPanel } from "./ui/ActionPanel.js";
import { GameLog } from "./ui/GameLog.js";
import { PrivateRoleCard } from "./ui/PrivateRoleCard.js";
import { GameOverPanel } from "./ui/GameOverPanel.js";

export function SecretHitlerGame({ room }: { room: Room }) {
  const state = useSHState(room);

  // Private-message handlers are registered by setupRoomHandlers when the room
  // is first set (see games/secret-hitler/index.tsx). Here we only reset the
  // private store on unmount so role/hand info doesn't leak across games.
  useEffect(() => {
    return () => usePrivateInfo.getState().reset();
  }, []);

  if (!state) return null;

  return (
    <>
      <SHScene state={state} />
      <div className="sh-overlay">
        <Header state={state} />
        <div className="sh-middle">
          <PlayerList state={state} mySessionId={room.sessionId} />
          <div className="sh-center-col">
            <ActionPanel state={state} room={room} mySessionId={room.sessionId} />
            <PrivateRoleCard state={state} />
          </div>
          <GameLog state={state} />
        </div>
        {state.gamePhase === "game-over" && (
          <GameOverPanel state={state} room={room} mySessionId={room.sessionId} />
        )}
      </div>
    </>
  );
}
