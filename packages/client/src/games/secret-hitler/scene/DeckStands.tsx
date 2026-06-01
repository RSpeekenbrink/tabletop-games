import * as THREE from "three";
import { Html } from "@react-three/drei";
import type { SHSnapshot } from "../useSHState.js";
import { useObjGeometry } from "./useObj.js";
import { useFullTexture } from "./useCardTexture.js";
import { OBJ, PILE } from "./textures.js";

const PILE_SCALE = 0.24;

interface Props {
  state: SHSnapshot;
}

/**
 * Draw + discard card stands (discard_draw_pile.obj). The OBJ is a single
 * flat tray; we instance it twice and texture each with its pile art.
 */
export function DeckStands({ state }: Props) {
  const geometry = useObjGeometry(OBJ.pile);
  const drawTex = useFullTexture(PILE.draw);
  const discardTex = useFullTexture(PILE.discard);

  return (
    <group position={[0, 0.01, 2.3]}>
      <Stand
        geometry={geometry}
        texture={drawTex}
        x={-1.9}
        label="Draw"
        count={state.drawPileCount}
      />
      <Stand
        geometry={geometry}
        texture={discardTex}
        x={1.9}
        label="Discard"
        count={state.discardPileCount}
      />
    </group>
  );
}

function Stand({
  geometry,
  texture,
  x,
  label,
  count,
}: {
  geometry: THREE.BufferGeometry;
  texture: THREE.Texture;
  x: number;
  label: string;
  count: number;
}) {
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={geometry} scale={[PILE_SCALE, PILE_SCALE, PILE_SCALE]}>
        <meshStandardMaterial map={texture} roughness={0.8} />
      </mesh>
      <Html
        position={[0, 0.25, 0]}
        center
        distanceFactor={9}
        pointerEvents="none"
        zIndexRange={[8, 0]}
      >
        <div className="sh3d-chip">
          {label} {count}
        </div>
      </Html>
    </group>
  );
}
