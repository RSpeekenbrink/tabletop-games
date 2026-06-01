import { useMemo } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { SHSnapshot } from "../useSHState.js";
import { useObjGeometry } from "./useObj.js";
import { useCardTexture, useFullTexture } from "./useCardTexture.js";
import { OBJ, TRACKER, POLICY_CELLS } from "./textures.js";
import { Card } from "./cardGeometry.js";

const BOARD_SCALE = 0.12;
const BOARD_HALF_WIDTH = 14 * BOARD_SCALE; // native X ∈ [-14, 14]
const LIB_Z = -1.35;
const FAS_Z = 1.0;
const MARKER_WIDTH = 0.46;
const MARKER_SPAN = 2.3; // total world width occupied by the slot row

interface Props {
  state: SHSnapshot;
}

/** Liberal + fascist policy boards (tracker.obj) with enacted-policy markers. */
export function PolicyTrackers({ state }: Props) {
  const geometry = useObjGeometry(OBJ.tracker);
  const liberalTex = useFullTexture(TRACKER.liberal);
  const fascistTex = useFullTexture(TRACKER.fascist(state.players.length));

  return (
    <group>
      <Board
        geometry={geometry}
        texture={liberalTex}
        z={LIB_Z}
        slots={5}
        filled={state.liberalPolicies}
        policyCell={POLICY_CELLS.liberal}
      />
      <Board
        geometry={geometry}
        texture={fascistTex}
        z={FAS_Z}
        slots={6}
        filled={state.fascistPolicies}
        policyCell={POLICY_CELLS.fascist}
      />
      <ElectionTracker count={state.electionTracker} z={FAS_Z - 0.85} />
    </group>
  );
}

function Board({
  geometry,
  texture,
  z,
  slots,
  filled,
  policyCell,
}: {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  z: number;
  slots: number;
  filled: number;
  policyCell: number;
}) {
  const markerTex = useCardTexture("policy", policyCell);
  const xs = useMemo(() => slotPositions(slots), [slots]);
  return (
    <group position={[0, 0.01, z]}>
      <mesh geometry={geometry} scale={[BOARD_SCALE, BOARD_SCALE, BOARD_SCALE]}>
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
      {xs.slice(0, filled).map((x, i) => (
        <group key={i} position={[x, 0.04, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <Card front={markerTex} width={MARKER_WIDTH} />
        </group>
      ))}
    </group>
  );
}

/** Evenly spaced slot X positions centred on the board. */
function slotPositions(slots: number): number[] {
  if (slots <= 1) return [0];
  const step = MARKER_SPAN / (slots - 1);
  const start = -MARKER_SPAN / 2;
  return Array.from({ length: slots }, (_, i) => start + i * step);
}

function ElectionTracker({ count, z }: { count: number; z: number }) {
  return (
    <group position={[0, 0.05, z]}>
      {[0, 1, 2].map((i) => {
        const filled = i < count;
        return (
          <mesh key={i} position={[(i - 1) * 0.3, 0, 0]}>
            <sphereGeometry args={[0.09, 16, 16]} />
            <meshStandardMaterial
              color={filled ? "#ffd34d" : "#2a3242"}
              emissive={filled ? "#ffd34d" : "#000"}
              emissiveIntensity={filled ? 0.6 : 0}
            />
          </mesh>
        );
      })}
      <Html
        position={[0.7, 0, 0]}
        center
        distanceFactor={9}
        pointerEvents="none"
        zIndexRange={[8, 0]}
      >
        <div className="sh3d-chip">Tracker {count}/3</div>
      </Html>
    </group>
  );
}
