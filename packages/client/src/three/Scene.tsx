import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { ReactNode } from "react";

interface SceneProps {
  children?: ReactNode;
}

export function Scene({ children }: SceneProps) {
  return (
    <Canvas
      className="game-canvas"
      shadows
      camera={{ position: [0, 4, 6], fov: 50 }}
    >
      <color attach="background" args={["#0a0c12"]} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 8, 5]} intensity={1.0} castShadow />
      <OrbitControls makeDefault target={[0, 0, 0]} enablePan={false} />
      {children}
    </Canvas>
  );
}
