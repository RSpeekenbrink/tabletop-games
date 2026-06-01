import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { SHEETS, sliceTexture, type SheetId } from "./textures.js";

/**
 * Load a sprite sheet (cached by `useLoader` per URL) and return a cloned
 * texture windowed onto a single grid cell. Suspends until the image loads,
 * so callers must sit under a <Suspense> boundary.
 */
export function useCardTexture(sheet: SheetId, cell: number): THREE.Texture {
  const { url, cols, rows } = SHEETS[sheet];
  const base = useLoader(THREE.TextureLoader, url);
  return useMemo(() => sliceTexture(base, cols, rows, cell), [base, cols, rows, cell]);
}

/** Load a full (non-sliced) texture, e.g. a tracker board or pile face. */
export function useFullTexture(url: string): THREE.Texture {
  const tex = useLoader(THREE.TextureLoader, url);
  return useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    tex.needsUpdate = true;
    return tex;
  }, [tex]);
}
