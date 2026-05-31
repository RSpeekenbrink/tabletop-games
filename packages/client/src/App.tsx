import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import type { LobbyState } from "@tabletop-games/shared";
import { colyseusClient } from "./net/colyseusClient.js";
import { clearSession, getSession, setSession } from "./net/session.js";
import { useRoomStore } from "./net/roomStore.js";
import { Landing } from "./screens/Landing.js";
import { Lobby } from "./screens/Lobby.js";
import { GameView } from "./screens/GameView.js";

export function App() {
  const navigate = useNavigate();
  const room = useRoomStore((s) => s.room);
  const setRoom = useRoomStore((s) => s.setRoom);
  const [bootstrapped, setBootstrapped] = useState(false);

  // Boot-time reconnect. We use a ref to dedupe across React StrictMode's
  // dev-mode double-mount: tokens are single-use, so a second attempt with
  // the same token would always fail and clear the session, evicting the
  // user from the room the first attempt successfully reconnected to.
  const bootStartedRef = useRef(false);

  useEffect(() => {
    if (bootStartedRef.current) return;
    bootStartedRef.current = true;

    const session = getSession();
    if (!session) {
      setBootstrapped(true);
      return;
    }

    void (async () => {
      try {
        const r = await colyseusClient.reconnect<LobbyState>(session.reconnectionToken);
        // Persist the (possibly rotated) token so the next refresh has a
        // valid one to use.
        setSession({
          roomId: r.roomId,
          reconnectionToken: r.reconnectionToken,
          username: session.username,
        });
        setRoom(r);
        const phase = r.state?.phase ?? "lobby";
        navigate(phase === "in-game" || phase === "post-game" ? "/game" : "/lobby", {
          replace: true,
        });
      } catch {
        clearSession();
        navigate("/", { replace: true });
      } finally {
        setBootstrapped(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the room emits onLeave (network drop, server dispose, voluntary
  // leave), drop the in-memory room reference so the screens redirect to
  // the landing page. We deliberately DO NOT clear the persisted session
  // here: on a browser refresh the close event can fire during unload and
  // wipe sessionStorage before the new page can use it to reconnect. The
  // Lobby's explicit "Leave" button clears the session itself before
  // calling room.leave(true), and a failed reconnect on the next boot
  // clears it via the boot effect's catch branch.
  useEffect(() => {
    if (!room) return;
    const onLeaveHandler = () => {
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
