export const TABLE_RADIUS = 4.2;

/** The felt table the boards, piles and players sit around. */
export function Table() {
  return (
    <group>
      <mesh position={[0, -0.16, 0]} receiveShadow>
        <cylinderGeometry args={[TABLE_RADIUS, TABLE_RADIUS, 0.3, 72]} />
        <meshStandardMaterial color="#13392c" roughness={0.95} metalness={0} />
      </mesh>
      {/* Raised wooden rim. */}
      <mesh position={[0, -0.04, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[TABLE_RADIUS, 0.16, 20, 80]} />
        <meshStandardMaterial color="#5a3a22" roughness={0.7} />
      </mesh>
    </group>
  );
}
