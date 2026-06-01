import { Suspense, lazy, useEffect, useState } from "react";
import type { Room } from "colyseus.js";
import { useSHState } from "./useSHState.js";
import { usePrivateInfo } from "./privateInfo.js";
import { Header } from "./ui/Header.js";
import { GameLog } from "./ui/GameLog.js";
import { PromptStrip } from "./ui/PromptStrip.js";
import { GameOverPanel } from "./ui/GameOverPanel.js";
import { isWebGLAvailable } from "./scene/webgl.js";

// Three.js is heavy — keep it out of the lobby/initial bundle.
const SHScene = lazy(() => import("./scene/SHScene.js"));

export function SecretHitlerGame({ room }: { room: Room }) {
  const state = useSHState(room);
  const [webgl] = useState(() => isWebGLAvailable());

  useEffect(() => {
    return () => usePrivateInfo.getState().reset();
  }, []);

  if (!state) return null;

  if (!webgl) {
    return (
      <div className="sh-game sh3d-fallback">
        <p>This 3D board needs WebGL, which isn't available in this browser.</p>
        <p className="muted">Try a different browser or enable hardware acceleration.</p>
      </div>
    );
  }

  const me = state.players.find((p) => p.sessionId === room.sessionId);
  const username = me?.username ?? "";

  return (
    <div className="sh-game sh-game-3d">
      <Suspense fallback={<div className="sh3d-loading">Loading board…</div>}>
        <SHScene
          state={state}
          mySessionId={room.sessionId}
          username={username}
          room={room}
        />
      </Suspense>

      <div className="sh3d-overlay">
        <Header state={state} room={room} mySessionId={room.sessionId} />
        <details className="sh3d-log">
          <summary>Log</summary>
          <GameLog state={state} />
        </details>
        <PromptStrip state={state} room={room} mySessionId={room.sessionId} />
      </div>

      {state.gamePhase === "game-over" && (
        <GameOverPanel state={state} room={room} mySessionId={room.sessionId} />
      )}
    </div>
  );
}
