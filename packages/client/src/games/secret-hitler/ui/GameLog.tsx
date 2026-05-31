import { useEffect, useRef } from "react";
import type { SHSnapshot } from "../useSHState.js";

export function GameLog({ state }: { state: SHSnapshot }) {
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [state.gameLog.length]);
  return (
    <div className="sh-log">
      <h3>Log</h3>
      <div className="sh-log-list" ref={listRef}>
        {state.gameLog.map((line, i) => (
          <div key={i} className="sh-log-entry">
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
