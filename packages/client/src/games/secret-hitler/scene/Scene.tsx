import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { Table } from "../../../three/Table.js";
import { PolicyTrack } from "./PolicyTrack.js";
import { ElectionTracker } from "./ElectionTracker.js";
import { DeckPiles } from "./DeckPiles.js";
import { Podiums } from "./Podiums.js";
import type { SHSnapshot } from "../useSHState.js";

export function SHScene({ state }: { state: SHSnapshot }) {
  return (
    <Canvas className="game-canvas" shadows camera={{ position: [0, 5.5, 6.5], fov: 50 }}>
      <color attach="background" args={["#0a0c12"]} />
      <ambientLight intensity={0.5} />
      <directionalLight position={[6, 10, 6]} intensity={1.1} castShadow />
      <OrbitControls
        makeDefault
        target={[0, 0, 0]}
        enablePan={false}
        minPolarAngle={0.2}
        maxPolarAngle={1.4}
        minDistance={4}
        maxDistance={12}
      />
      <Table />
      <PolicyTrack kind="liberal" count={state.liberalPolicies} />
      <PolicyTrack kind="fascist" count={state.fascistPolicies} />
      <ElectionTracker count={state.electionTracker} />
      <DeckPiles draw={state.drawPileCount} discard={state.discardPileCount} />
      <Podiums state={state} />
    </Canvas>
  );
}
