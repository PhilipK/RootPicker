import { byId, REACH_TARGET, TRACK_MAX } from "../data/factions";
import { useAppContext } from "../context/AppContext";

export function ReachTracker({ selectedIds }: { selectedIds: Set<string> }) {
  const { playerCount, effTarget } = useAppContext();
  const recTarget = REACH_TARGET[playerCount];
  const picks = [...selectedIds].map((id) => byId[id]);
  const total = picks.reduce((s, f) => s + f.reach, 0);
  const n = picks.length;

  const pct = (v: number) => `${Math.min(100, (v / TRACK_MAX) * 100)}%`;

  let cls: string;
  let text: string;
  if (n === 0) {
    cls = "neutral";
    text = "pick your factions";
  } else if (n !== playerCount) {
    cls = "neutral";
    text = n < playerCount ? `pick ${playerCount - n} more` : `${n - playerCount} too many — drop some`;
  } else if (total >= recTarget) {
    cls = "ok";
    text = "good fit";
  } else if (total >= 17) {
    cls = "adventurous";
    text = "adventurous (17+)";
  } else {
    cls = "bad";
    text = "not enough reach";
  }

  const fillCls = total >= recTarget ? "ok" : total >= 17 ? "adventurous" : "bad";

  const warnings: string[] = [];
  const cornerCount = picks.filter((f) => f.corner).length;
  if (cornerCount >= 5)
    warnings.push(`${cornerCount} factions start in corner clearings — you must use the Advanced Setup (Law 5)`);
  if (playerCount === 2 && n === 2)
    warnings.push("Two players: remove the four dominance cards from the deck (5.1.3)");

  const hideAdvLabel = recTarget - 17 < 3 && recTarget !== 17;

  return (
    <div id="tracker">
      <div className="inner">
        <div className="row1">
          <span className="totals">
            Reach <b>{total}</b> / <span>{effTarget}</span> needed
          </span>
          <span className={`stamp ${cls}`}>{text}</span>
        </div>
        <div className="track">
          <div className="ticks" />
          <div className={`fill ${fillCls}`} style={{ width: pct(total) }} />
          <div className="mark adv" style={{ left: pct(17) }} />
          <div className="mark" style={{ left: pct(recTarget) }} />
        </div>
        <div className="track-labels">
          <span className={hideAdvLabel ? "hidden" : ""} style={{ left: pct(17) }}>
            17 adventurous
          </span>
          <span style={{ left: pct(recTarget) }}>{recTarget} recommended</span>
        </div>
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i}>{w}</div>
          ))}
        </div>
      </div>
    </div>
  );
}
