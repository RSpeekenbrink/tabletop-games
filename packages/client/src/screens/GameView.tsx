import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MSG } from "@tabletop-games/shared";
import { useRoomStore } from "../net/roomStore.js";
import { useLobbyState } from "../net/useLobbyState.js";
import { getClientGame } from "../games/registry.js";
import { Scene } from "../three/Scene.js";
import { Table } from "../three/Table.js";

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

  return (
    <div className="game-view">
      {module ? (
        <module.Component room={room} />
      ) : (
        <>
          <Scene>
            <Table />
          </Scene>
          <div className="game-overlay">
            <div />
            <div className="card" style={{ alignSelf: "center" }}>
              <div>No client module registered for "{state.selectedGameId || "(none)"}"</div>
              {isHost && (
                <button onClick={() => room.send(MSG.RETURN_TO_LOBBY, {})}>
                  Back to lobby
                </button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
