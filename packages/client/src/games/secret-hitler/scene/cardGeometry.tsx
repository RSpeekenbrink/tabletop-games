import { useMemo } from "react";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";

// Physical card proportions taken from the art (735 × 1024 px cells).
export const CARD_ASPECT = 1024 / 735; // height / width
export const CARD_WIDTH = 0.62;
export const CARD_HEIGHT = CARD_WIDTH * CARD_ASPECT; // ≈ 0.86
export const CARD_THICKNESS = 0.012;
const CORNER_RADIUS_RATIO = 0.07; // corner radius as a fraction of card width

/** A rounded rectangle centred on the origin, in the XY plane. */
function roundedRectShape(w: number, h: number, r: number): THREE.Shape {
  const shape = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  shape.moveTo(x + r, y);
  shape.lineTo(x + w - r, y);
  shape.quadraticCurveTo(x + w, y, x + w, y + r);
  shape.lineTo(x + w, y + h - r);
  shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  shape.lineTo(x + r, y + h);
  shape.quadraticCurveTo(x, y + h, x, y + h - r);
  shape.lineTo(x, y + r);
  shape.quadraticCurveTo(x, y, x + r, y);
  return shape;
}

/**
 * UVs ExtrudeGeometry hands us are in shape (world) coordinates, but our sheet
 * textures are pre-sliced with offset/repeat onto the full 0..1 face. So we
 * normalise the cap UVs across the card's bounding box; the rectangular sides
 * only ever wear the solid edge material, so their UVs don't matter.
 */
function normalisedUVGenerator(w: number, h: number): THREE.UVGenerator {
  const u = (x: number) => (x + w / 2) / w;
  const v = (y: number) => (y + h / 2) / h;
  return {
    generateTopUV(_g, vertices, a, b, c) {
      return [
        new THREE.Vector2(u(vertices[a * 3]), v(vertices[a * 3 + 1])),
        new THREE.Vector2(u(vertices[b * 3]), v(vertices[b * 3 + 1])),
        new THREE.Vector2(u(vertices[c * 3]), v(vertices[c * 3 + 1])),
      ];
    },
    generateSideWallUV() {
      return [
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0, 0),
        new THREE.Vector2(0, 0),
      ];
    },
  };
}

// Rounded-card geometry is identical for a given width, so cache & share it
// across every instance (materials stay per-instance for the textures).
const geometryCache = new Map<string, THREE.ExtrudeGeometry>();

function cardGeometry(width: number): THREE.ExtrudeGeometry {
  const key = width.toFixed(3);
  let geom = geometryCache.get(key);
  if (!geom) {
    const height = width * CARD_ASPECT;
    const shape = roundedRectShape(width, height, width * CORNER_RADIUS_RATIO);
    geom = new THREE.ExtrudeGeometry(shape, {
      depth: CARD_THICKNESS,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 8,
      UVGenerator: normalisedUVGenerator(width, height),
    });
    geom.translate(0, 0, -CARD_THICKNESS / 2); // centre the thickness on z=0
    geometryCache.set(key, geom);
  }
  return geom;
}

interface CardProps {
  /** Texture for the faces. Sliced via useCardTexture. */
  front: THREE.Texture;
  width?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  /** Glow to signal the card is tappable. */
  highlight?: boolean;
  onClick?: (e: ThreeEvent<MouseEvent>) => void;
}

/**
 * A single playing card: a thin extruded rounded-rectangle so it reads as a
 * physical card with rounded corners, a textured face and pale edges. The
 * front face points +Z (toward the camera in hand layouts). ExtrudeGeometry
 * assigns material 0 to the front/back caps and material 1 to the rim.
 */
export function Card({
  front,
  width = CARD_WIDTH,
  position,
  rotation,
  highlight = false,
  onClick,
}: CardProps) {
  const geometry = useMemo(() => cardGeometry(width), [width]);
  const materials = useMemo(() => {
    const face = new THREE.MeshStandardMaterial({ map: front, roughness: 0.55 });
    const edge = new THREE.MeshStandardMaterial({ color: "#f0f0f0", roughness: 0.85 });
    face.emissive = new THREE.Color("#ffd34d");
    return [face, edge];
  }, [front]);

  // Toggle the highlight glow without rebuilding materials.
  materials[0].emissiveIntensity = highlight ? 0.45 : 0;

  return (
    <mesh
      geometry={geometry}
      material={materials}
      position={position}
      rotation={rotation}
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
    />
  );
}
