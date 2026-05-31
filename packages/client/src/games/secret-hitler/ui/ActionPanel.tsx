import { useState, type ReactNode } from "react";
import type { Room } from "colyseus.js";
import { MSG, SH_ACTION } from "@tabletop-games/shared";
import type { SHSnapshot, SHPlayerView } from "../useSHState.js";
import { usePrivateInfo } from "../privateInfo.js";

interface Props {
  state: SHSnapshot;
  room: Room;
  mySessionId: string;
}

const POLICY_LABEL: Record<string, string> = {
  liberal: "Liberal",
  fascist: "Fascist",
};

export function ActionPanel({ state, room, mySessionId }: Props) {
  const priv = usePrivateInfo();
  const me = state.players.find((p) => p.sessionId === mySessionId);
  const isPres = mySessionId === state.presidentSessionId;
  const isChan = mySessionId === state.chancellorSessionId;
  const aliveOthers = state.players.filter((p) => p.alive && p.sessionId !== mySessionId);

  const send = (type: string, data?: unknown) => {
    room.send(MSG.GAME_ACTION, { type, data });
  };

  if (state.gamePhase === "game-over") return null;

  if (state.gamePhase === "nomination") {
    if (!isPres) {
      return (
        <Panel>
          Waiting for President <b>{nameOf(state, state.presidentSessionId)}</b> to nominate.
        </Panel>
      );
    }
    const aliveCount = state.players.filter((p) => p.alive).length;
    const eligible = aliveOthers.filter((p) => {
      if (p.sessionId === state.lastChancellorSessionId) return false;
      if (aliveCount > 5 && p.sessionId === state.lastPresidentSessionId) return false;
      return true;
    });
    return (
      <PickPanel
        label="Nominate a Chancellor:"
        candidates={eligible}
        onConfirm={(sid) => send(SH_ACTION.NOMINATE_CHANCELLOR, { targetSessionId: sid })}
      />
    );
  }

  if (state.gamePhase === "election") {
    if (!me?.alive) return <Panel>You are eliminated. Watching only.</Panel>;
    if (me.votedThisRound) {
      const remaining = state.players.filter((p) => p.alive && !p.votedThisRound).length;
      return (
        <Panel>
          Vote cast. Waiting for {remaining} more player{remaining === 1 ? "" : "s"}.
        </Panel>
      );
    }
    const nominee = state.players.find((p) => p.sessionId === state.chancellorNomineeSessionId);
    return (
      <Panel>
        <div>
          Elect <b>{nominee?.username}</b> as Chancellor?
        </div>
        <div className="row">
          <button onClick={() => send(SH_ACTION.VOTE, { vote: "ja" })}>Ja!</button>
          <button onClick={() => send(SH_ACTION.VOTE, { vote: "nein" })}>Nein!</button>
        </div>
      </Panel>
    );
  }

  if (state.gamePhase === "legislative-president") {
    if (!isPres) {
      return (
        <Panel>
          President <b>{nameOf(state, state.presidentSessionId)}</b> is discarding a policy.
        </Panel>
      );
    }
    if (!priv.presidentHand) return <Panel>Waiting for your cards…</Panel>;
    return (
      <Panel>
        <div>Discard one policy:</div>
        <div className="row sh-cards">
          {priv.presidentHand.map((c, i) => (
            <button
              key={i}
              className={`sh-card sh-card-${c}`}
              onClick={() => {
                send(SH_ACTION.DISCARD_POLICY, { index: i });
                priv.clearHands();
              }}
            >
              {POLICY_LABEL[c]}
            </button>
          ))}
        </div>
      </Panel>
    );
  }

  if (state.gamePhase === "legislative-chancellor") {
    if (!isChan) {
      return (
        <Panel>
          Chancellor <b>{nameOf(state, state.chancellorSessionId)}</b> is enacting a policy.
        </Panel>
      );
    }
    if (!priv.chancellorHand) return <Panel>Waiting for your cards…</Panel>;
    return (
      <Panel>
        <div>Enact one policy:</div>
        <div className="row sh-cards">
          {priv.chancellorHand.map((c, i) => (
            <button
              key={i}
              className={`sh-card sh-card-${c}`}
              onClick={() => {
                send(SH_ACTION.ENACT_POLICY, { index: i });
                priv.clearHands();
              }}
            >
              {POLICY_LABEL[c]}
            </button>
          ))}
        </div>
        {state.vetoUnlocked && (
          <button onClick={() => send(SH_ACTION.PROPOSE_VETO, {})}>Propose Veto</button>
        )}
      </Panel>
    );
  }

  if (state.gamePhase === "veto-response") {
    if (!isPres) {
      return <Panel>Chancellor proposed Veto. Waiting for President's response.</Panel>;
    }
    return (
      <Panel>
        <div>Chancellor proposed Veto. Agree to discard both cards?</div>
        <div className="row">
          <button onClick={() => send(SH_ACTION.VETO_RESPONSE, { agree: true })}>Yes, veto</button>
          <button onClick={() => send(SH_ACTION.VETO_RESPONSE, { agree: false })}>
            No, enact
          </button>
        </div>
      </Panel>
    );
  }

  if (state.gamePhase === "executive-action") {
    const power = state.pendingExecutivePower;
    if (!isPres) {
      const target = state.executivePowerTargetSessionId
        ? nameOf(state, state.executivePowerTargetSessionId)
        : null;
      return (
        <Panel>
          President is using <b>{power}</b>
          {target ? <> on <b>{target}</b></> : null}.
        </Panel>
      );
    }
    if (power === "peek") {
      return (
        <Panel>
          <div>Top 3 of draw pile:</div>
          {priv.peekResult ? (
            <div className="row sh-cards">
              {priv.peekResult.map((c, i) => (
                <div key={i} className={`sh-card sh-card-${c}`}>
                  {POLICY_LABEL[c]}
                </div>
              ))}
            </div>
          ) : (
            <div className="muted">Waiting…</div>
          )}
          <button
            onClick={() => {
              send(SH_ACTION.ACKNOWLEDGE_PEEK, {});
              priv.clearPeekResult();
            }}
          >
            OK
          </button>
        </Panel>
      );
    }
    if (power === "investigate") {
      const eligible = aliveOthers.filter((p) => !p.investigated);
      return (
        <PickPanel
          label="Investigate which player?"
          candidates={eligible}
          onConfirm={(sid) => send(SH_ACTION.INVESTIGATE_PLAYER, { targetSessionId: sid })}
        />
      );
    }
    if (power === "execute") {
      return (
        <PickPanel
          label="Execute which player?"
          candidates={aliveOthers}
          onConfirm={(sid) => send(SH_ACTION.EXECUTE_PLAYER, { targetSessionId: sid })}
        />
      );
    }
    if (power === "special-election") {
      return (
        <PickPanel
          label="Choose next President:"
          candidates={aliveOthers}
          onConfirm={(sid) => send(SH_ACTION.CHOOSE_NEXT_PRESIDENT, { targetSessionId: sid })}
        />
      );
    }
  }

  return null;
}

function Panel({ children }: { children: ReactNode }) {
  return <div className="sh-action-panel">{children}</div>;
}

function PickPanel({
  label,
  candidates,
  onConfirm,
}: {
  label: string;
  candidates: SHPlayerView[];
  onConfirm: (sid: string) => void;
}) {
  const [target, setTarget] = useState("");
  return (
    <Panel>
      <div>{label}</div>
      <select value={target} onChange={(e) => setTarget(e.target.value)}>
        <option value="">— pick a player —</option>
        {candidates.map((c) => (
          <option key={c.sessionId} value={c.sessionId}>
            {c.username}
          </option>
        ))}
      </select>
      <button disabled={!target} onClick={() => onConfirm(target)}>
        Confirm
      </button>
    </Panel>
  );
}

function nameOf(state: SHSnapshot, sid: string): string {
  return state.players.find((p) => p.sessionId === sid)?.username ?? "?";
}
