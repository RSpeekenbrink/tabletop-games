export function ElectionTracker({ count }: { count: number }) {
  return (
    <group position={[0, 0.18, 0]}>
      {[0, 1, 2].map((i) => {
        const filled = i < count;
        return (
          <mesh key={i} position={[(i - 1) * 0.3, 0, 0]}>
            <sphereGeometry args={[0.1, 16, 16]} />
            <meshStandardMaterial
              color={filled ? "#ffb000" : "#555"}
              emissive={filled ? "#5a3500" : "#000"}
            />
          </mesh>
        );
      })}
    </group>
  );
}
