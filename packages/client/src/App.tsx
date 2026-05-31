import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { LobbyState } from "@tabletop-games/shared";
import { colyseusClient } from "./net/colyseusClient.js";
import { clearSession, getSession } from "./net/session.js";
import { useRoomStore } from "./net/roomStore.js";
import { Landing } from "./screens/Landing.js";
import { Lobby } from "./screens/Lobby.js";
import { GameView } from "./screens/GameView.js";

export function App() {
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const [bootstrapped, setBootstrapped] = useState(false);

  // On first mount, attempt to reconnect using the persisted Colyseus
  // reconnectionToken. If it succeeds we drop straight into the lobby/game;
  // if not (room gone, timeout expired) we clear and show the landing screen.
  useEffect(() => {
    let cancelled = false;
    const session = getSession();
    if (!session) {
      setBootstrapped(true);
      return;
    }

    void (async () => {
      try {
        const r = await colyseusClient.reconnect<LobbyState>(
          session.reconnectionToken,
        );
        if (cancelled) return;
        setRoom(r);
        const phase = r.state?.phase ?? "lobby";
        navigate(phase === "in-game" || phase === "post-game" ? "/game" : "/lobby", {
          replace: true,
        });
      } catch {
        clearSession();
        if (!cancelled) navigate("/", { replace: true });
      } finally {
        if (!cancelled) setBootstrapped(true);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Per-game private message handlers are registered synchronously in
  // roomStore.setRoom. Here we only handle the disconnect flow.
  useEffect(() => {
    if (!room) return;
    const onLeaveHandler = () => {
      clearSession();
      setRoom(null);
      navigate("/", { replace: true });
    };
    room.onLeave(onLeaveHandler);
    return () => room.onLeave.remove(onLeaveHandler);
  }, [room, navigate, setRoom]);

  if (!bootstrapped) {
    return (
      <div className="screen screen-center">
        <div className="muted">Connecting…</div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/lobby" element={<Lobby />} />
      <Route path="/game" element={<GameView />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
