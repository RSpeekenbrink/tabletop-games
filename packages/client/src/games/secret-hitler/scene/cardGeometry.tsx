import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

// Physical card proportions taken from the art (735 × 1024 px cells).
export const CARD_ASPECT = 1024 / 735; // height / width
export const CARD_WIDTH = 0.62;
export const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT; // ≈ 0.86
export const CARD_THICKNESS = 0.012;

interface CardProps {
  /** Texture for the face (+Z). Sliced via useCardTexture. */
  front: THREE.Texture;
  /** Optional back texture (−Z). Defaults to the front. */
  back?: THREE.Texture;
  width?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Lift + glow to signal the card is tappable. */
  highlight?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

/**
 * A single playing card: a thin box so it reads as a physical card with
 * front, back and pale edges. BoxGeometry material order is
 * [+X, −X, +Y, −Y, +Z, −Z]; the front faces +Z (toward the camera in hand
 * layouts). Sliced textures already carry offset/repeat, so each face maps
 * the chosen sheet cell across the full 0..1 face UV.
 */
export function Card({
  front,
  back,
  width = CARD_WIDTH,
  position,
  rotation,
  highlight = false,
  onClick,
}: CardProps) {
  const height = width * CARD_ASPECT;
  const materials = useMemo(() => {
    const edge = new THREE.MeshStandardMaterial({ color: "#ececec", roughness: 0.85 });
    const frontMat = new THREE.MeshStandardMaterial({ map: front, roughness: 0.55 });
    const backMat = new THREE.MeshStandardMaterial({ map: back ?? front, roughness: 0.55 });
    return [edge, edge, edge, edge, frontMat, backMat];
  }, [front, back]);

  // Apply/clear the highlight glow without rebuilding materials.
  const glow = highlight ? 0.45 : 0;
  materials[4].emissive = new THREE.Color("#ffd34d");
  materials[4].emissiveIntensity = glow;

  return (
    <mesh
      position={position}
      rotation={rotation}
      material={materials}
      onClick={onClick}
      onPointerOver={(e) => {
        if (onClick) {
          e.stopPropagation();
          document.body.style.cursor = "pointer";
        }
      }}
      onPointerOut={() => {
        if (onClick) document.body.style.cursor = "auto";
      }}
    >
      <boxGeometry args={[width, height, CARD_THICKNESS]} />
    </mesh>
  );
}
