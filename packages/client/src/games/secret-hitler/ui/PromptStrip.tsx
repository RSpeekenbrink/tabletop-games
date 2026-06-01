import type { ReactNode } from "react";
import type { Room } from "colyseus.js";
import type { SHSnapshot } from "../useSHState.js";
import { usePrivateInfo } from "../privateInfo.js";
import { useSHActions } from "../scene/useSHActions.js";

interface Props {
  state: SHSnapshot;
  room: Room;
  mySessionId: string;
}

/**
 * Bottom prompt strip: status text plus the non-spatial action buttons that
 * don't map onto a 3D card or seat tap (veto response, peek acknowledge,
 * propose veto). Spatial choices — nominate/vote/discard/enact/target — are
 * made by tapping cards and seats in the scene; this strip narrates them.
 */
export function PromptStrip({ state, room, mySessionId }: Props) {
  const priv = usePrivateInfo();
  const actions = useSHActions(room);
  const me = state.players.find((p) => p.sessionId === mySessionId);
  const isPres = mySessionId === state.presidentSessionId;
  const isChan = mySessionId === state.chancellorSessionId;
  const name = (sid: string) => state.players.find((p) => p.sessionId === sid)?.username ?? "?";

  let body: ReactNode = null;

  switch (state.gamePhase) {
    case "night":
      body = <span>Roles dealt. The game is starting…</span>;
      break;

    case "nomination":
      body = isPres ? (
        <span>Tap a glowing player to nominate as Chancellor.</span>
      ) : (
        <span>
          Waiting for President <b>{name(state.presidentSessionId)}</b> to nominate.
        </span>
      );
      break;

    case "election": {
      if (!me?.alive) {
        body = <span>You are eliminated. Watching only.</span>;
      } else if (me.votedThisRound) {
        const remaining = state.players.filter((p) => p.alive && !p.votedThisRound).length;
        body = (
          <span>
            Vote cast. Waiting for {remaining} more player{remaining === 1 ? "" : "s"}.
          </span>
        );
      } else {
        body = (
          <span>
            Elect <b>{name(state.chancellorNomineeSessionId)}</b>? Tap Ja or Nein in your hand.
          </span>
        );
      }
      break;
    }

    case "legislative-president":
      body = isPres ? (
        priv.presidentHand ? (
          <span>Tap a policy in your hand to discard.</span>
        ) : (
          <span>Waiting for your cards…</span>
        )
      ) : (
        <span>
          President <b>{name(state.presidentSessionId)}</b> is discarding a policy.
        </span>
      );
      break;

    case "legislative-chancellor":
      body = isChan ? (
        <span className="sh3d-prompt-row">
          {priv.chancellorHand ? "Tap a policy to enact." : "Waiting for your cards…"}
          {state.vetoUnlocked && (
            <button onClick={() => actions.proposeVeto()}>Propose Veto</button>
          )}
        </span>
      ) : (
        <span>
          Chancellor <b>{name(state.chancellorSessionId)}</b> is enacting a policy.
        </span>
      );
      break;

    case "veto-response":
      body = isPres ? (
        <span className="sh3d-prompt-row">
          Chancellor proposed Veto. Discard both cards?
          <button onClick={() => actions.vetoRespond(true)}>Yes, veto</button>
          <button onClick={() => actions.vetoRespond(false)}>No, enact</button>
        </span>
      ) : (
        <span>Chancellor proposed Veto. Waiting for the President's response.</span>
      );
      break;

    case "executive-action": {
      const power = state.pendingExecutivePower;
      if (!isPres) {
        const target = state.executivePowerTargetSessionId
          ? name(state.executivePowerTargetSessionId)
          : null;
        body = (
          <span>
            President is using <b>{power}</b>
            {target ? (
              <>
                {" "}
                on <b>{target}</b>
              </>
            ) : null}
            .
          </span>
        );
      } else if (power === "peek") {
        body = (
          <span className="sh3d-prompt-row">
            Top 3 of the draw pile are shown in your hand.
            <button
              onClick={() => {
                actions.acknowledgePeek();
                priv.clearPeekResult();
              }}
            >
              OK
            </button>
          </span>
        );
      } else if (power === "investigate") {
        body = priv.investigateResult ? (
          <span>
            <b>{name(priv.investigateResult.targetSessionId)}</b> is a{" "}
            <b>{priv.investigateResult.party}</b>.
          </span>
        ) : (
          <span>Tap a glowing player to investigate their party.</span>
        );
      } else if (power === "execute") {
        body = <span>Tap a glowing player to execute.</span>;
      } else if (power === "special-election") {
        body = <span>Tap a glowing player to be the next President.</span>;
      }
      break;
    }
  }

  if (!body) return null;
  return <div className="sh3d-prompt">{body}</div>;
}
