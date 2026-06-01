import { useEffect, useRef, useState } from "react";
import { Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { ErrorCode } from "colyseus.js";
import { LEAVE_CODE_KICKED, type LobbyState } from "@tabletop-games/shared";
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
  // When the boot-time reconnect fails we deliberately don't wipe the stored
  // session: the most common cause is "another tab of mine is already in this
  // room", and the original tab needs its token intact. We surface an error
  // screen that lets the user retry or explicitly start fresh.
  const [reconnectFailed, setReconnectFailed] = useState(false);

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
      } catch (err) {
        // A disposed/missing room means the lobby was deleted while we were
        // away — the session is dead and unrecoverable, so wipe it and fall
        // through to the regular landing page rather than nagging the user
        // about a phantom other tab.
        if ((err as { code?: number })?.code === ErrorCode.MATCHMAKE_INVALID_ROOM_ID) {
          clearSession();
          navigate("/", { replace: true });
          return;
        }
        // Otherwise don't clear the stored session. The token may still be
        // valid for the original tab — Colyseus rejects a reconnect while the
        // original socket is still alive (MATCHMAKE_EXPIRED), and using
        // clearSession() here would wipe the shared localStorage entry the
        // original tab relies on.
        setReconnectFailed(true);
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
  // wipe localStorage before the new page can use it to reconnect. The
  // Lobby's explicit "Leave" button clears the session itself before
  // calling room.leave(true).
  useEffect(() => {
    if (!room) return;
    const onLeaveHandler = (code: number) => {
      // Terminal leaves (kick, server disposal) must wipe the persisted
      // session — otherwise the next page load reconnect-loops on a stale
      // token. Soft drops (network) preserve it for the reconnect window.
      if (code === LEAVE_CODE_KICKED) clearSession();
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

  if (reconnectFailed) {
    return (
      <div className="screen screen-center">
        <div className="card">
          <h2 style={{ margin: 0 }}>Already connected</h2>
          <div className="muted">
            We couldn't reconnect this tab. You're probably already in this room
            in another tab — switch to that tab to keep playing. If your
            session has expired instead, start a fresh one.
          </div>
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button
              onClick={() => {
                clearSession();
                setReconnectFailed(false);
                navigate("/", { replace: true });
              }}
            >
              Start fresh
            </button>
            <button onClick={() => window.location.reload()}>Retry</button>
          </div>
        </div>
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
