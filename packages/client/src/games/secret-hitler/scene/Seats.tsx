import { useMemo } from "react";
import { Html } from "@react-three/drei";
import { Avatar } from "../../../ui/Avatar.js";
import type { SHSnapshot, SHPlayerView } from "../useSHState.js";
import { tappableSeats, type SHActions } from "./useSHActions.js";
import { Card } from "./cardGeometry.js";
import { useCardTexture } from "./useCardTexture.js";
import { VOTE_CELLS } from "./textures.js";

export const SEAT_RADIUS = 4.65;

interface SeatLayout {
  player: SHPlayerView;
  x: number;
  z: number;
  /** Angle from +Z (player's facing direction toward table centre). */
  facing: number;
}

interface Props {
  state: SHSnapshot;
  mySessionId: string;
  actions: SHActions;
}

/** Avatars seated in a ring, rotated so the local player sits at the front. */
export function Seats({ state, mySessionId, actions }: Props) {
  const seats = useSeatLayout(state, mySessionId);
  const tappable = tappableSeats(state, mySessionId);

  const onSeatClick = (sid: string) => {
    if (!tappable.has(sid)) return;
    const phase = state.gamePhase;
    if (phase === "nomination") {
      actions.nominate(sid);
    } else if (phase === "executive-action") {
      const power = state.pendingExecutivePower;
      if (power === "investigate") actions.investigate(sid);
      else if (power === "execute") actions.execute(sid);
      else if (power === "special-election") actions.chooseNextPresident(sid);
    }
  };

  return (
    <group>
      {seats.map((seat) => (
        <Seat
          key={seat.player.sessionId}
          seat={seat}
          state={state}
          mySessionId={mySessionId}
          tappable={tappable.has(seat.player.sessionId)}
          onClick={() => onSeatClick(seat.player.sessionId)}
        />
      ))}
    </group>
  );
}

function useSeatLayout(state: SHSnapshot, mySessionId: string): SeatLayout[] {
  return useMemo(() => {
    // Seat by the shuffled play order; fall back to the player list order.
    const order =
      state.seatOrder.length > 0
        ? state.seatOrder
        : state.players.map((p) => p.sessionId);
    const byId = new Map(state.players.map((p) => [p.sessionId, p]));
    const seated = order.map((id) => byId.get(id)).filter(Boolean) as SHPlayerView[];
    const n = seated.length || 1;
    const localIndex = Math.max(0, seated.findIndex((p) => p.sessionId === mySessionId));

    return seated.map((player, i) => {
      // Rotate so the local player is at angle 0 (= +Z, nearest the camera).
      const angle = ((i - localIndex) / n) * Math.PI * 2;
      return {
        player,
        x: Math.sin(angle) * SEAT_RADIUS,
        z: Math.cos(angle) * SEAT_RADIUS,
        facing: angle,
      };
    });
  }, [state.seatOrder, state.players, mySessionId]);
}

function Seat({
  seat,
  state,
  mySessionId,
  tappable,
  onClick,
}: {
  seat: SeatLayout;
  state: SHSnapshot;
  mySessionId: string;
  tappable: boolean;
  onClick: () => void;
}) {
  const { player, x, z } = seat;
  const isPres = player.sessionId === state.presidentSessionId;
  const isChan =
    player.sessionId === state.chancellorSessionId ||
    player.sessionId === state.chancellorNomineeSessionId;
  const isMe = player.sessionId === mySessionId;

  const padColor = isPres ? "#caa23a" : isChan ? "#2f8fb3" : "#1d2433";
  const padEmissive = isPres ? "#ffd34d" : isChan ? "#54d0ff" : tappable ? "#3a6" : "#000";
  const padGlow = isPres || isChan ? 0.7 : tappable ? 0.5 : 0;

  return (
    <group position={[x, 0, z]}>
      {/* Clickable seat pad on the table edge. */}
      <mesh
        position={[0, 0.02, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onClick={(e) => {
          if (!tappable) return;
          e.stopPropagation();
          onClick();
        }}
        onPointerOver={(e) => {
          if (!tappable) return;
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          if (tappable) document.body.style.cursor = "auto";
        }}
      >
        <circleGeometry args={[0.55, 40]} />
        <meshStandardMaterial
          color={padColor}
          emissive={padEmissive}
          emissiveIntensity={padGlow}
          roughness={0.6}
        />
      </mesh>

      <SeatVoteToken seat={seat} state={state} />

      {/* Avatar + name + status as an HTML billboard floating above the pad. */}
      <Html position={[0, 0.7, 0]} center distanceFactor={9} zIndexRange={[10, 0]} pointerEvents="none">
        <div className={`sh3d-seat ${!player.alive ? "dead" : ""} ${isMe ? "me" : ""}`}>
          <Avatar seed={player.username} size={44} />
          <div className="sh3d-seat-name">
            {player.username}
            {isMe ? " (you)" : ""}
          </div>
          <div className="sh3d-seat-tags">
            {isPres && <span className="sh3d-tag pres">President</span>}
            {isChan && <span className="sh3d-tag chan">Chancellor</span>}
            {!player.alive && <span className="sh3d-tag dead">✕ dead</span>}
            {player.alive && !player.connected && <span className="sh3d-tag off">offline</span>}
            {player.votedThisRound && state.gamePhase === "election" && (
              <span className="sh3d-tag voted">voted</span>
            )}
          </div>
        </div>
      </Html>
    </group>
  );
}

/** Floating ja/nein card above a seat once votes are revealed. */
function SeatVoteToken({ seat, state }: { seat: SeatLayout; state: SHSnapshot }) {
  const vote = state.votes.get(seat.player.sessionId);
  const show = state.votesRevealed && !!vote;
  const cell = vote === "ja" ? VOTE_CELLS.ja : VOTE_CELLS.nein;
  const tex = useCardTexture("vote", show ? cell : VOTE_CELLS.back);
  if (!show) return null;
  return (
    <group position={[0, 0.45, 0.35]} rotation={[-Math.PI / 3, 0, 0]}>
      <Card front={tex} width={0.34} />
    </group>
  );
}
