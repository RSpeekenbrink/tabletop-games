import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { GameDescriptor } from "@tabletop-games/shared";
import { MSG } from "@tabletop-games/shared";
import { useRoomStore } from "../net/roomStore.js";
import { useLobbyState } from "../net/useLobbyState.js";
import { clearSession } from "../net/session.js";

export function Lobby() {
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const state = useLobbyState();
  const [availableGames, setAvailableGames] = useState<GameDescriptor[]>([]);

  useEffect(() => {
    if (!room) {
      navigate("/");
      return;
    }
  }, [room, navigate]);

  useEffect(() => {
    void fetch("/api/games")
      .then((r) => (r.ok ? r.json() : []))
      .then((g) => setAvailableGames(g as GameDescriptor[]))
      .catch(() => setAvailableGames([]));
  }, []);

  useEffect(() => {
    if (state?.phase === "in-game") navigate("/game");
  }, [state?.phase, navigate]);

  if (!room || !state) return null;

  const mySessionId = room.sessionId;
  const isHost = state.hostSessionId === mySessionId;
  const selected = availableGames.find((g) => g.id === state.selectedGameId);
  const playerCount = state.players.length;
  const canStart =
    isHost &&
    !!selected &&
    playerCount >= selected.minPlayers &&
    playerCount <= selected.maxPlayers;

  async function leave() {
    if (!room) return;
    clearSession();
    await room.leave(true);
    setRoom(null);
    navigate("/");
  }

  return (
    <div className="lobby">
      <div className="lobby-main">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 style={{ margin: 0 }}>Lobby</h2>
          <button onClick={leave}>Leave</button>
        </div>

        <div className="row">
          <span className="muted">Room code</span>
          <span className="shortcode">{state.shortcode}</span>
        </div>

        <div className="card" style={{ minWidth: 0 }}>
          <div className="muted">Game</div>
          {isHost ? (
            <select
              value={state.selectedGameId}
              onChange={(e) =>
                room.send(MSG.SELECT_GAME, { gameId: e.target.value })
              }
            >
              <option value="">— pick a game —</option>
              {availableGames.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name} ({g.minPlayers}-{g.maxPlayers}p)
                </option>
              ))}
            </select>
          ) : (
            <div>{selected ? selected.name : <span className="muted">waiting for host</span>}</div>
          )}

          {availableGames.length === 0 && (
            <div className="muted">No games available yet.</div>
          )}

          {selected && (
            <div className="muted">
              Players: {playerCount} (needs {selected.minPlayers}-{selected.maxPlayers})
            </div>
          )}

          {isHost && (
            <button
              disabled={!canStart}
              onClick={() => room.send(MSG.START_GAME, {})}
            >
              Start game
            </button>
          )}
        </div>
      </div>

      <div className="lobby-side">
        <div className="muted">Players</div>
        {state.players.map((p) => (
          <div key={p.sessionId} className="player-row">
            <span>
              {p.username}
              {p.sessionId === mySessionId ? " (you)" : ""}
            </span>
            <span className="row" style={{ gap: "0.25rem" }}>
              {p.sessionId === state.hostSessionId && (
                <span className="badge host">host</span>
              )}
              {!p.connected && <span className="badge offline">offline</span>}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
