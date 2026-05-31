interface Props {
  kind: "liberal" | "fascist";
  count: number;
}

export function PolicyTrack({ kind, count }: Props) {
  const slots = kind === "liberal" ? 5 : 6;
  const z = kind === "liberal" ? -2.2 : 2.2;
  const baseColor = kind === "liberal" ? "#1a4980" : "#7a1a1a";
  const filledColor = kind === "liberal" ? "#4aa3f0" : "#ef5350";
  const slotWidth = 0.6;
  const gap = 0.12;
  const totalWidth = slots * slotWidth + (slots - 1) * gap;
  const startX = -totalWidth / 2 + slotWidth / 2;
  return (
    <group position={[0, 0.12, z]}>
      {Array.from({ length: slots }).map((_, i) => {
        const filled = i < count;
        return (
          <mesh key={i} position={[startX + i * (slotWidth + gap), 0, 0]}>
            <boxGeometry args={[slotWidth, 0.06, 0.45]} />
            <meshStandardMaterial color={filled ? filledColor : baseColor} />
          </mesh>
        );
      })}
    </group>
  );
}
