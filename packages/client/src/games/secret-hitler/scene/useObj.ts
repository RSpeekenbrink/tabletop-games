import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";

/**
 * Load a Wavefront .obj and return its first mesh's geometry. The geometry is
 * safe to share across many instances (each instance supplies its own
 * material), so we keep the cached buffer rather than cloning it. The OBJs in
 * this game carry positions + UVs but no materials, so we always apply our own.
 */
export function useObjGeometry(url: string): THREE.BufferGeometry {
  const group = useLoader(OBJLoader, url);
  return useMemo(() => {
    let geometry: THREE.BufferGeometry | null = null;
    group.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!geometry && mesh.isMesh) {
        geometry = mesh.geometry as THREE.BufferGeometry;
        geometry.computeVertexNormals();
      }
    });
    return geometry ?? new THREE.BufferGeometry();
  }, [group]);
}
