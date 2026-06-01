import { type RefObject } from "react";
import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { SHSnapshot } from "../useSHState.js";
import { useObjGeometry } from "./useObj.js";
import { useFullTexture, useCardTexture } from "./useCardTexture.js";
import { Card, CARD_THICKNESS } from "./cardGeometry.js";
import { OBJ, PILE, POLICY_CELLS } from "./textures.js";

// The OBJ tray is large; squash it down (per-axis) so its top footprint just
// holds a policy card with a little margin. Y is kept thin so it reads as a
// plate rather than a block.
const PLATE_SCALE: [number, number, number] = [0.19, 0.16, 0.18];
// Lay a card flat, face-up, sitting just above the plate's top surface.
const CARD_FLAT_ROTATION: [number, number, number] = [-Math.PI / 2, 0, 0];
const STACK_BASE_Y = 0.045;
// Never draw more than a full deck's worth of cards (17), regardless of state.
const MAX_STACK = 17;

interface Props {
  state: SHSnapshot;
  /** Hand-card group used to occlude the deck chips when behind a card. */
  occluder: RefObject<THREE.Object3D>;
}

/**
 * Draw + discard piles. Each is a scaled-down tray (discard_draw_pile.obj)
 * with a physical stack of face-down policy cards on top whose height tracks
 * the live count. The discard tray is flipped so its plain back faces up.
 */
export function DeckStands({ state, occluder }: Props) {
  const geometry = useObjGeometry(OBJ.pile);
  const drawTex = useFullTexture(PILE.draw);
  const discardTex = useFullTexture(PILE.discard);
  const backTex = useCardTexture("policy", POLICY_CELLS.back);

  return (
    <group position={[0, 0.01, 2.3]}>
      <Stand
        geometry={geometry}
        texture={drawTex}
        backTex={backTex}
        x={-1.9}
        label="Draw"
        count={state.drawPileCount}
        occluder={occluder}
      />
      <Stand
        geometry={geometry}
        texture={discardTex}
        backTex={backTex}
        x={1.9}
        label="Discard"
        count={state.discardPileCount}
        occluder={occluder}
        flipped
      />
    </group>
  );
}

function Stand({
  geometry,
  texture,
  backTex,
  x,
  label,
  count,
  occluder,
  flipped = false,
}: {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  backTex: THREE.Texture;
  x: number;
  label: string;
  count: number;
  occluder: RefObject<THREE.Object3D>;
  flipped?: boolean;
}) {
  const cards = Math.min(Math.max(count, 0), MAX_STACK);
  return (
    <group position={[x, 0, 0]}>
      <mesh
        geometry={geometry}
        scale={PLATE_SCALE}
        rotation={flipped ? [Math.PI, 0, 0] : [0, 0, 0]}
      >
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>

      {/* Physical stack of face-down cards; height grows with the count. */}
      {Array.from({ length: cards }, (_, i) => (
        <Card
          key={i}
          front={backTex}
          position={[0, STACK_BASE_Y + i * CARD_THICKNESS, 0]}
          rotation={CARD_FLAT_ROTATION}
        />
      ))}

      <Html
        position={[0, 0.25, 0]}
        center
        distanceFactor={9}
        pointerEvents="none"
        zIndexRange={[8, 0]}
        occlude={[occluder]}
      >
        <div className="sh3d-chip">
          {label} {count}
        </div>
      </Html>
    </group>
  );
}
