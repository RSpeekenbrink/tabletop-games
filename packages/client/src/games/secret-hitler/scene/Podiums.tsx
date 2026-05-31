import type { SHSnapshot } from "../useSHState.js";

export function Podiums({ state }: { state: SHSnapshot }) {
  const order = state.seatOrder;
  const n = order.length;
  if (n === 0) return null;
  const radius = 3.3;
  return (
    <group>
      {order.map((sid, i) => {
        const p = state.players.find((pp) => pp.sessionId === sid);
        if (!p) return null;
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const isPres = sid === state.presidentSessionId;
        const isChan =
          sid === state.chancellorSessionId || sid === state.chancellorNomineeSessionId;
        const color = !p.alive
          ? "#2a2a2a"
          : isPres
            ? "#ffd060"
            : isChan
              ? "#60ccff"
              : "#888";
        const emissive = isPres ? "#5a4810" : isChan ? "#103040" : "#000";
        return (
          <group key={sid} position={[x, 0, z]}>
            <mesh position={[0, 0.3, 0]}>
              <cylinderGeometry args={[0.28, 0.32, 0.6, 18]} />
              <meshStandardMaterial color={color} emissive={emissive} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
