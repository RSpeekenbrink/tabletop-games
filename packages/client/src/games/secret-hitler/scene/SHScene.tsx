import { Suspense, useEffect, useRef, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import type { Room } from "colyseus.js";
import type { SHSnapshot } from "../useSHState.js";
import { useSHActions } from "./useSHActions.js";
import { Table } from "./Table.js";
import { Seats } from "./Seats.js";
import { PolicyTrackers } from "./PolicyTrackers.js";
import { DeckStands } from "./DeckStands.js";
import { LocalHand } from "./LocalHand.js";

interface Props {
  state: SHSnapshot;
  mySessionId: string;
  username: string;
  room: Room;
}

/** The full 3D Secret Hitler board. Default export so it can be React.lazy'd. */
export default function SHScene({ state, mySessionId, username, room }: Props) {
  const actions = useSHActions(room);
  // The local player's cards live glued to the camera in the foreground. Share
  // their group with the HTML billboards (seat names, deck chips) so those
  // overlays are occluded by — and never paint over — the cards in hand.
  const handRef = useRef<THREE.Group>(null);
  const handOccluder = handRef as RefObject<THREE.Object3D>;

  return (
    <Canvas
      className="sh3d-canvas"
      dpr={[1, 2]}
      frameloop="demand"
      camera={{ position: [0, 7.6, 7], fov: 55, near: 0.1, far: 100 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={["#0a0c12"]} />
      <ambientLight intensity={0.75} />
      <directionalLight position={[5, 11, 6]} intensity={1.15} />
      <directionalLight position={[-6, 6, -5]} intensity={0.3} />
      <CameraRig />

      <Suspense fallback={null}>
        <Table />
        <PolicyTrackers state={state} />
        <DeckStands state={state} occluder={handOccluder} />
        <Seats
          state={state}
          mySessionId={mySessionId}
          actions={actions}
          occluder={handOccluder}
        />
        <LocalHand
          ref={handRef}
          state={state}
          mySessionId={mySessionId}
          username={username}
          actions={actions}
        />
      </Suspense>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping={false}
        minDistance={5}
        maxDistance={14}
        minPolarAngle={0.2}
        maxPolarAngle={1.18}
        target={[0, 0, 0.4]}
      />
    </Canvas>
  );
}

/** Widen the field of view in portrait so the whole table fits on a phone. */
function CameraRig() {
  const camera = useThree((s) => s.camera);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    cam.fov = height >= width ? 64 : 50;
    cam.updateProjectionMatrix();
  }, [camera, width, height]);
  return null;
}
