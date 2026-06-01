import type { SHSnapshot } from "../useSHState.js";

interface Props {
  state: SHSnapshot;
}

export function Board({ state }: Props) {
  return (
    <div className="sh-board">
      <Track kind="liberal" count={state.liberalPolicies} total={5} />
      <Track kind="fascist" count={state.fascistPolicies} total={6} />
      <div className="sh-board-meta">
        <Tracker count={state.electionTracker} />
        <DeckCounts draw={state.drawPileCount} discard={state.discardPileCount} />
      </div>
    </div>
  );
}

function Track({ kind, count, total }: { kind: "liberal" | "fascist"; count: number; total: number }) {
  const slots = Array.from({ length: total }, (_, i) => i < count);
  return (
    <div className={`sh-track sh-track-${kind}`}>
      <span className="sh-track-label">{kind === "liberal" ? "Liberal" : "Fascist"}</span>
      <div className="sh-track-slots">
        {slots.map((filled, i) => (
          <span
            key={i}
            className={`sh-slot sh-slot-${kind} ${filled ? "filled" : ""}`}
            aria-label={filled ? `${kind} policy enacted` : "empty slot"}
          />
        ))}
      </div>
      <span className="sh-track-count">
        {count}/{total}
      </span>
    </div>
  );
}

function Tracker({ count }: { count: number }) {
  return (
    <div className="sh-tracker" title="Election tracker">
      <span className="sh-tracker-label">Tracker</span>
      <div className="sh-tracker-pips">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`sh-pip ${i < count ? "filled" : ""}`} />
        ))}
      </div>
    </div>
  );
}

function DeckCounts({ draw, discard }: { draw: number; discard: number }) {
  return (
    <div className="sh-deck">
      <span className="sh-deck-stack" title="Draw pile">
        <span className="sh-deck-label">Draw</span>
        <span className="sh-deck-count">{draw}</span>
      </span>
      <span className="sh-deck-stack" title="Discard pile">
        <span className="sh-deck-label">Discard</span>
        <span className="sh-deck-count">{discard}</span>
      </span>
    </div>
  );
}
