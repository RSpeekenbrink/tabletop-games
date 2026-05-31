export function Table() {
  return (
    <group>
      <mesh receiveShadow position={[0, 0, 0]}>
        <cylinderGeometry args={[3, 3, 0.15, 64]} />
        <meshStandardMaterial color="#3a2a1a" roughness={0.7} />
      </mesh>
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 1.0, 16]} />
        <meshStandardMaterial color="#2a1d10" />
      </mesh>
    </group>
  );
}
