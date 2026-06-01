import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MSG } from "@tabletop-games/shared";
import { useRoomStore } from "../net/roomStore.js";
import { useLobbyState } from "../net/useLobbyState.js";
import { getClientGame } from "../games/registry.js";

export function GameView() {
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const state = useLobbyState();

  useEffect(() => {
    if (!room) navigate("/");
  }, [room, navigate]);

  useEffect(() => {
    if (state && state.phase !== "in-game" && state.phase !== "post-game") {
      navigate("/lobby");
    }
  }, [state?.phase, navigate, state]);

  if (!room || !state) return null;

  const module = getClientGame(state.selectedGameId);
  const isHost = state.hostSessionId === room.sessionId;

  if (module) {
    return (
      <div className="game-view">
        <module.Component room={room} />
      </div>
    );
  }

  return (
    <div className="screen screen-center">
      <div className="card">
        <div>No client module registered for "{state.selectedGameId || "(none)"}"</div>
        {isHost && (
          <button onClick={() => room.send(MSG.RETURN_TO_LOBBY, {})}>
            Back to lobby
          </button>
        )}
      </div>
    </div>
  );
}
