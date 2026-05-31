import { usePrivateInfo } from "../privateInfo.js";
import type { SHSnapshot } from "../useSHState.js";

const ROLE_LABEL: Record<string, string> = {
  liberal: "Liberal",
  fascist: "Fascist",
  hitler: "Hitler",
};

interface Props {
  state: SHSnapshot;
}

export function PrivateRoleCard({ state }: Props) {
  const priv = usePrivateInfo();
  if (!priv.role) return null;
  const inv = priv.investigateResult;
  const investigated = inv ? state.players.find((p) => p.sessionId === inv.targetSessionId) : null;
  return (
    <div className={`sh-role-card role-${priv.role}`}>
      <div className="sh-role-line">
        Your role: <b>{ROLE_LABEL[priv.role]}</b>
      </div>
      {priv.knownAllies.length > 0 && (
        <div className="sh-role-line">
          You know:{" "}
          {priv.knownAllies.map((a, i) => (
            <span key={a.sessionId}>
              {i > 0 ? ", " : ""}
              <b>{a.username}</b> ({ROLE_LABEL[a.role]})
            </span>
          ))}
        </div>
      )}
      {inv && investigated && (
        <div className="sh-role-line">
          You investigated <b>{investigated.username}</b>: party is <b>{inv.party}</b>.
        </div>
      )}
    </div>
  );
}
