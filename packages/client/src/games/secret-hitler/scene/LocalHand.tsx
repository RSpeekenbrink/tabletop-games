import { useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import type { SHSnapshot } from "../useSHState.js";
import { usePrivateInfo } from "../privateInfo.js";
import { Card } from "./cardGeometry.js";
import { useCardTexture } from "./useCardTexture.js";
import {
  roleCardCell,
  partyCellForRole,
  policyCell,
  VOTE_CELLS,
  type SheetId,
} from "./textures.js";
import type { SHActions } from "./useSHActions.js";

interface Props {
  state: SHSnapshot;
  mySessionId: string;
  username: string;
  actions: SHActions;
}

/**
 * The local player's cards, glued to the camera so they always sit at the
 * bottom-centre of the viewport regardless of how the board is orbited.
 * Role + party cards are always shown (face-up, only to this player); the
 * centre slot shows whatever the current phase asks the player to tap.
 */
export function LocalHand({ state, mySessionId, username, actions }: Props) {
  const ref = useRef<THREE.Group>(null);
  const { camera } = useThree();
  const priv = usePrivateInfo();

  // Match the camera's transform every frame → children are camera-relative.
  useFrame(() => {
    if (!ref.current) return;
    ref.current.position.copy(camera.position);
    ref.current.quaternion.copy(camera.quaternion);
  });

  const me = state.players.find((p) => p.sessionId === mySessionId);
  const isPres = mySessionId === state.presidentSessionId;
  const isChan = mySessionId === state.chancellorSessionId;

  return (
    <group ref={ref}>
      {/* Personal role + party, lower-left so they never block action cards. */}
      {priv.role && (
        <>
          <HandCard
            sheet="role"
            cell={roleCardCell(priv.role, username)}
            width={0.44}
            position={[-1.32, -0.92, -2.5]}
            rotation={[0.28, 0.18, 0]}
          />
          <HandCard
            sheet="party"
            cell={partyCellForRole(priv.role)}
            width={0.44}
            position={[-0.84, -0.96, -2.5]}
            rotation={[0.28, 0.12, 0]}
          />
        </>
      )}

      {/* Election: tap Ja / Nein. */}
      {state.gamePhase === "election" && me?.alive && !me.votedThisRound && (
        <>
          <HandCard
            sheet="vote"
            cell={VOTE_CELLS.ja}
            width={0.8}
            position={[-0.55, -0.7, -2.2]}
            rotation={[0.2, 0, 0]}
            onClick={() => actions.vote("ja")}
          />
          <HandCard
            sheet="vote"
            cell={VOTE_CELLS.nein}
            width={0.8}
            position={[0.55, -0.7, -2.2]}
            rotation={[0.2, 0, 0]}
            onClick={() => actions.vote("nein")}
          />
        </>
      )}

      {/* President legislative: discard one of three. */}
      {state.gamePhase === "legislative-president" && isPres && priv.presidentHand && (
        <PolicyRow
          cards={priv.presidentHand}
          onPick={(i) => {
            actions.discardPolicy(i);
            priv.clearHands();
          }}
        />
      )}

      {/* Chancellor legislative: enact one of two. */}
      {state.gamePhase === "legislative-chancellor" && isChan && priv.chancellorHand && (
        <PolicyRow
          cards={priv.chancellorHand}
          onPick={(i) => {
            actions.enactPolicy(i);
            priv.clearHands();
          }}
        />
      )}

      {/* Executive peek: look at the top three (no choice). */}
      {state.gamePhase === "executive-action" &&
        isPres &&
        state.pendingExecutivePower === "peek" &&
        priv.peekResult && <PolicyRow cards={priv.peekResult} />}
    </group>
  );
}

function PolicyRow({
  cards,
  onPick,
}: {
  cards: ("liberal" | "fascist")[];
  onPick?: (index: number) => void;
}) {
  const n = cards.length;
  return (
    <>
      {cards.map((c, i) => (
        <HandCard
          key={i}
          sheet="policy"
          cell={policyCell(c)}
          width={0.72}
          position={[(i - (n - 1) / 2) * 0.85, -0.72, -2.2]}
          rotation={[0.2, 0, 0]}
          onClick={onPick ? () => onPick(i) : undefined}
        />
      ))}
    </>
  );
}

function HandCard({
  sheet,
  cell,
  ...rest
}: {
  sheet: SheetId;
  cell: number;
  width?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  onClick?: () => void;
}) {
  const tex = useCardTexture(sheet, cell);
  return <Card front={tex} {...rest} />;
}
