import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { LobbyState } from "@tabletop-games/shared";
import { colyseusClient } from "../net/colyseusClient.js";
import { setSession } from "../net/session.js";
import { useRoomStore } from "../net/roomStore.js";

type Mode = "menu" | "join";

export function Landing() {
  const navigate = useNavigate();
  const setRoom = useRoomStore((s) => s.setRoom);

  const [username, setUsername] = useState("");
  const [shortcode, setShortcode] = useState("");
  const [mode, setMode] = useState<Mode>("menu");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameOk = username.trim().length >= 1 && username.trim().length <= 32;

  async function handleCreate() {
    if (!usernameOk) return;
    setBusy(true);
    setError(null);
    try {
      const room = await colyseusClient.create<LobbyState>("tabletop-games", {
        username: username.trim(),
      });
      setSession({
        roomId: room.roomId,
        reconnectionToken: room.reconnectionToken,
        username: username.trim(),
      });
      setRoom(room);
      navigate("/lobby");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create room");
    } finally {
      setBusy(false);
    }
  }

  async function handleJoin() {
    if (!usernameOk) return;
    const code = shortcode.trim().toUpperCase();
    if (code.length < 3) {
      setError("Enter a room code");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const resp = await fetch(`/api/rooms/${code}`);
      if (!resp.ok) {
        setError("Room not found");
        setBusy(false);
        return;
      }
      const { roomId } = (await resp.json()) as { roomId: string };
      const room = await colyseusClient.joinById<LobbyState>(roomId, {
        username: username.trim(),
      });
      setSession({
        roomId: room.roomId,
        reconnectionToken: room.reconnectionToken,
        username: username.trim(),
      });
      setRoom(room);
      navigate("/lobby");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join room");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="screen screen-center">
      <div className="card">
        <h1 style={{ margin: 0 }}>Tabletop</h1>
        <label>
          <div className="muted">Username</div>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            maxLength={32}
            placeholder="your display name"
            autoFocus
          />
        </label>

        {mode === "menu" && (
          <div className="row" style={{ justifyContent: "space-between" }}>
            <button disabled={!usernameOk || busy} onClick={handleCreate}>
              Create room
            </button>
            <button disabled={!usernameOk || busy} onClick={() => setMode("join")}>
              Join by code
            </button>
          </div>
        )}

        {mode === "join" && (
          <>
            <label>
              <div className="muted">Room code</div>
              <input
                value={shortcode}
                onChange={(e) => setShortcode(e.target.value.toUpperCase())}
                maxLength={6}
                placeholder="ABCD"
                style={{ textTransform: "uppercase", letterSpacing: "0.2em" }}
              />
            </label>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <button disabled={busy} onClick={() => setMode("menu")}>
                Back
              </button>
              <button disabled={!usernameOk || busy} onClick={handleJoin}>
                Join
              </button>
            </div>
          </>
        )}

        {error && <div className="error">{error}</div>}
      </div>
    </div>
  );
}
