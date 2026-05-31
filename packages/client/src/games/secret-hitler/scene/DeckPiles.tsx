interface Props {
  draw: number;
  discard: number;
}

export function DeckPiles({ draw, discard }: Props) {
  const drawH = Math.max(0.02, draw * 0.018);
  const discardH = Math.max(0.02, discard * 0.018);
  return (
    <group>
      {draw > 0 && (
        <mesh position={[-1.5, 0.1 + drawH / 2, 1.2]}>
          <boxGeometry args={[0.4, drawH, 0.55]} />
          <meshStandardMaterial color="#2c2c2c" />
        </mesh>
      )}
      {discard > 0 && (
        <mesh position={[1.5, 0.1 + discardH / 2, 1.2]}>
          <boxGeometry args={[0.4, discardH, 0.55]} />
          <meshStandardMaterial color="#1a1a1a" />
        </mesh>
      )}
    </group>
  );
}
