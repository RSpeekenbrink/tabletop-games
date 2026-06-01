import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import type { GameDescriptor } from "@tabletop-games/shared";
import { MSG } from "@tabletop-games/shared";
import type { Room } from "colyseus.js";
import { useRoomStore } from "../net/roomStore.js";
import { useLobbyState } from "../net/useLobbyState.js";
import { clearSession } from "../net/session.js";
import { getClientGame } from "../games/registry.js";
import { Avatar } from "../ui/Avatar.js";
import logoUrl from "../assets/branding/tabletop_games.png";

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
    if (state?.phase === "in-game" || state?.phase === "post-game") navigate("/game");
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
          <div className="row">
            <img src={logoUrl} alt="Tabletop Games" className="lobby-logo" />
            <h2 style={{ margin: 0 }}>Lobby</h2>
          </div>
          <button onClick={leave}>Leave</button>
        </div>

        <div className="row">
          <span className="muted">Room code</span>
          <span className="shortcode">{state.shortcode}</span>
        </div>

        <div className="lobby-games">
          <div className="muted">{isHost ? "Choose a game" : "Game"}</div>

          {availableGames.length === 0 ? (
            <div className="muted">No games available yet.</div>
          ) : (
            <div className="game-grid">
              {availableGames.map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  selected={g.id === state.selectedGameId}
                  interactive={isHost}
                  onSelect={() => room.send(MSG.SELECT_GAME, { gameId: g.id })}
                />
              ))}
            </div>
          )}

          {!isHost && !selected && availableGames.length > 0 && (
            <div className="muted">Waiting for the host to choose a game…</div>
          )}

          {selected && (
            <div className="lobby-start">
              <span className="muted">
                {playerCount} {playerCount === 1 ? "player" : "players"} · needs{" "}
                {selected.minPlayers}-{selected.maxPlayers}
              </span>
              {isHost && (
                <button
                  className="primary"
                  disabled={!canStart}
                  onClick={() => room.send(MSG.START_GAME, {})}
                >
                  Start game
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="lobby-side">
        <div className="muted">Players</div>
        {state.players.map((p) => {
          const isThisHost = p.sessionId === state.hostSessionId;
          const isSelf = p.sessionId === mySessionId;
          const showMenu = isHost && !isSelf;
          return (
            <div key={p.sessionId} className="player-row">
              <span className="player-identity">
                <Avatar seed={p.username} size={32} />
                <span>
                  {p.username}
                  {isSelf ? " (you)" : ""}
                </span>
              </span>
              <span className="row" style={{ gap: "0.25rem" }}>
                {isThisHost && <span className="badge host">host</span>}
                {!p.connected && <span className="badge offline">offline</span>}
                {showMenu && (
                  <PlayerActionsMenu
                    room={room}
                    targetSessionId={p.sessionId}
                    targetUsername={p.username}
                    canAppoint={!isThisHost && p.connected}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface GameCardProps {
  game: GameDescriptor;
  selected: boolean;
  interactive: boolean;
  onSelect: () => void;
}

/**
 * A single game tile in the lobby grid (Steam-library style): full-bleed
 * background art with the title, tagline and player count overlaid. Art and
 * styling are pulled from the client game registry; games without art fall
 * back to a generic dark tile.
 */
function GameCard({ game, selected, interactive, onSelect }: GameCardProps) {
  const card = getClientGame(game.id)?.card;
  const style = {
    "--card-art": card?.art ? `url(${card.art})` : undefined,
    "--card-accent": card?.accent,
  } as CSSProperties;

  return (
    <button
      type="button"
      className={`game-card${selected ? " selected" : ""}`}
      style={style}
      onClick={onSelect}
      disabled={!interactive}
      aria-pressed={selected}
      title={game.description ?? game.name}
    >
      <span className="game-card-art" aria-hidden="true" />
      {selected && (
        <span className="game-card-check" aria-hidden="true">
          ✓
        </span>
      )}
      <span className="game-card-body">
        <span className="game-card-title">{game.name}</span>
        {card?.tagline && (
          <span className="game-card-tagline">{card.tagline}</span>
        )}
        <span className="game-card-players">
          {game.minPlayers}-{game.maxPlayers} players
        </span>
      </span>
    </button>
  );
}

interface PlayerActionsMenuProps {
  room: Room;
  targetSessionId: string;
  targetUsername: string;
  canAppoint: boolean;
}

function PlayerActionsMenu({
  room,
  targetSessionId,
  targetUsername,
  canAppoint,
}: PlayerActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDocPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDocPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const appoint = () => {
    room.send(MSG.APPOINT_HOST, { sessionId: targetSessionId });
    setOpen(false);
  };
  const kick = () => {
    if (!window.confirm(`Kick ${targetUsername} from the room?`)) return;
    room.send(MSG.KICK_PLAYER, { sessionId: targetSessionId });
    setOpen(false);
  };

  return (
    <div className="actions-menu" ref={wrapRef}>
      <button
        type="button"
        className="actions-menu-trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${targetUsername}`}
        title="Actions"
        onClick={() => setOpen((v) => !v)}
      >
        ⋮
      </button>
      {open && (
        <div className="actions-menu-popover" role="menu">
          <button
            type="button"
            role="menuitem"
            disabled={!canAppoint}
            onClick={appoint}
          >
            Make host
          </button>
          <button
            type="button"
            role="menuitem"
            className="danger"
            onClick={kick}
          >
            Kick
          </button>
        </div>
      )}
    </div>
  );
}
