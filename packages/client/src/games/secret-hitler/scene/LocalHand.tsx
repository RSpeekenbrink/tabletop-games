import { useMemo, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import type { SHSnapshot } from "../useSHState.js";
import { usePrivateInfo } from "../privateInfo.js";
import { Card, CARD_ASPECT } from "./cardGeometry.js";
import { useCardTexture } from "./useCardTexture.js";
import {
  roleCardCell,
  partyCellForRole,
  partyCell,
  policyCell,
  VOTE_CELLS,
  type SheetId,
} from "./textures.js";
import type { SHActions } from "./useSHActions.js";

interface Props {
  state: SHSnapshot;
  mySessionId: string;
  username: string;
  actions: SHActions;
  /** Group ref, shared so HTML billboards can use the hand as an occluder. */
  ref: RefObject<THREE.Group | null>;
}

/**
 * The local player's cards, glued to the camera so they always sit at the
 * bottom-centre of the viewport regardless of how the board is orbited.
 * Role + party cards are always shown (face-up, only to this player); the
 * centre slot shows whatever the current phase asks the player to tap.
 */
export function LocalHand({ state, mySessionId, username, actions, ref }: Props) {
  const { camera } = useThree();
  const priv = usePrivateInfo();

  // Match the camera's transform every frame → children are camera-relative.
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.copy(camera.position);
    ref.current.quaternion.copy(camera.quaternion);
  });

  const me = state.players.find((p) => p.sessionId === mySessionId);
  const isPres = mySessionId === state.presidentSessionId;
  const isChan = mySessionId === state.chancellorSessionId;

  return (
    <group ref={ref}>
      {/* Personal role + party, tucked into the bottom-centre of the screen so
          only their tops peek out; hover (desktop) or tap (mobile) to raise. */}
      {priv.role && (
        <>
          <TuckCard sheet="role" cell={roleCardCell(priv.role, username)} x={-0.32} />
          <TuckCard sheet="party" cell={partyCellForRole(priv.role)} x={0.32} />
        </>
      )}

      {/* Election: tap Ja / Nein. */}
      {state.gamePhase === "election" && me?.alive && !me.votedThisRound && (
        <>
          <HandCard
            sheet="vote"
            cell={VOTE_CELLS.ja}
            width={0.8}
            position={[-0.55, -0.7, -2.2]}
            rotation={[0.2, 0, 0]}
            onClick={() => actions.vote("ja")}
          />
          <HandCard
            sheet="vote"
            cell={VOTE_CELLS.nein}
            width={0.8}
            position={[0.55, -0.7, -2.2]}
            rotation={[0.2, 0, 0]}
            onClick={() => actions.vote("nein")}
          />
        </>
      )}

      {/* President legislative: discard one of three. */}
      {state.gamePhase === "legislative-president" && isPres && priv.presidentHand && (
        <PolicyRow
          cards={priv.presidentHand}
          onPick={(i) => {
            actions.discardPolicy(i);
            priv.clearHands();
          }}
        />
      )}

      {/* Chancellor legislative: enact one of two. */}
      {state.gamePhase === "legislative-chancellor" && isChan && priv.chancellorHand && (
        <PolicyRow
          cards={priv.chancellorHand}
          onPick={(i) => {
            actions.enactPolicy(i);
            priv.clearHands();
          }}
        />
      )}

      {/* Executive peek: look at the top three (no choice). */}
      {state.gamePhase === "executive-action" &&
        isPres &&
        state.pendingExecutivePower === "peek" &&
        priv.peekResult && <PolicyRow cards={priv.peekResult} />}

      {/* Executive investigate: reveal the chosen player's party card. */}
      {state.gamePhase === "executive-action" &&
        isPres &&
        state.pendingExecutivePower === "investigate" &&
        priv.investigateResult && (
          <HandCard
            sheet="party"
            cell={partyCell(priv.investigateResult.party)}
            width={0.72}
            position={[0, -0.72, -2.2]}
            rotation={[0.2, 0, 0]}
          />
        )}
    </group>
  );
}

function PolicyRow({
  cards,
  onPick,
}: {
  cards: ("liberal" | "fascist")[];
  onPick?: (index: number) => void;
}) {
  const n = cards.length;
  return (
    <>
      {cards.map((c, i) => (
        <HandCard
          key={i}
          sheet="policy"
          cell={policyCell(c)}
          width={0.72}
          position={[(i - (n - 1) / 2) * 0.85, -0.72, -2.2]}
          rotation={[0.2, 0, 0]}
          onClick={onPick ? () => onPick(i) : undefined}
        />
      ))}
    </>
  );
}

function HandCard({
  sheet,
  cell,
  ...rest
}: {
  sheet: SheetId;
  cell: number;
  width?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  onClick?: () => void;
}) {
  const tex = useCardTexture(sheet, cell);
  return <Card front={tex} {...rest} />;
}

// Geometry for the tuck-away role/party cards, all camera-relative.
const TUCK_Z = -2.5;
const TUCK_WIDTH = 0.5;
const TUCK_HALF = (TUCK_WIDTH * CARD_ASPECT) / 2;
const TUCK_PEEK = 0.34; // how much of the card top stays visible when tucked
const TUCK_MARGIN = 0.14; // gap below the card once fully raised
const TUCK_ROT_X = 0.42; // tilted back while tucked
const REVEAL_ROT_X = 0.12; // faces the player once raised

/**
 * A personal card (role / party) parked at the bottom-centre of the viewport.
 * Only its top edge peeks out until the player hovers (desktop) or taps
 * (mobile), which slides it up to full view; tapping again tucks it back.
 * The card is glued to the camera, so its rest/raised heights are derived
 * from the live vertical FOV at its depth — keeping it on-screen on any
 * aspect ratio, including narrow phones.
 */
function TuckCard({ sheet, cell, x }: { sheet: SheetId; cell: number; x: number }) {
  const tex = useCardTexture(sheet, cell);
  const ref = useRef<THREE.Group>(null);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const [hovered, setHovered] = useState(false);
  const [pinned, setPinned] = useState(false);
  const shown = hovered || pinned;

  // Stable initial transform so re-renders never reset our animated values.
  const initPos = useMemo<[number, number, number]>(() => [x, -2, TUCK_Z], [x]);
  const initRot = useMemo<[number, number, number]>(() => [TUCK_ROT_X, 0, 0], []);

  useFrame((_, dt) => {
    const g = ref.current;
    if (!g) return;
    const cam = camera as THREE.PerspectiveCamera;
    const halfH = Math.abs(TUCK_Z) * Math.tan((cam.fov * Math.PI) / 360);
    const targetY = shown
      ? -halfH + TUCK_MARGIN + TUCK_HALF
      : -halfH + TUCK_PEEK - TUCK_HALF;
    const targetRotX = shown ? REVEAL_ROT_X : TUCK_ROT_X;
    const k = Math.min(1, dt * 14); // framerate-independent ease toward target
    g.position.y += (targetY - g.position.y) * k;
    g.rotation.x += (targetRotX - g.rotation.x) * k;
    if (
      Math.abs(targetY - g.position.y) > 0.0005 ||
      Math.abs(targetRotX - g.rotation.x) > 0.0005
    ) {
      invalidate(); // keep frames coming while still settling (frameloop=demand)
    }
  });

  const setCursor = (v: string) => (document.body.style.cursor = v);

  return (
    <group
      ref={ref}
      position={initPos}
      rotation={initRot}
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
        setCursor("pointer");
        invalidate();
      }}
      onPointerOut={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(false);
        setCursor("auto");
        invalidate();
      }}
      onClick={(e: ThreeEvent<MouseEvent>) => {
        e.stopPropagation();
        setPinned((p) => !p);
        invalidate();
      }}
    >
      <Card front={tex} width={TUCK_WIDTH} />
    </group>
  );
}
