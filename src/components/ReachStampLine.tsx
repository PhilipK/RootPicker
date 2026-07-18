import type { CSSProperties, ReactNode } from "react";
import { reachVerdict } from "../lib/reach";
import { LeafSvg, LEAF_COLORS } from "./LeafSvg";

/** Scatter pattern for the celebratory burst: direction, drift, and spin per leaf. */
const BURST: Array<{ dx: number; dy: number; rot: number }> = [
  { dx: -46, dy: -26, rot: -140 },
  { dx: -30, dy: 18, rot: 120 },
  { dx: -8, dy: -34, rot: -90 },
  { dx: 12, dy: 26, rot: 160 },
  { dx: 34, dy: -20, rot: 100 },
  { dx: 50, dy: 10, rot: -120 },
];

export function ReachStampLine({ total, recommended, extra }: { total: number; recommended: number; extra?: ReactNode }) {
  const { cls, label } = reachVerdict(total, recommended);
  const celebrate = cls !== "bad";
  return (
    <p>
      Reach <b>{total}</b> / {recommended} recommended &nbsp;
      <span className="stamp-wrap">
        {celebrate && (
          <span className="stamp-burst" aria-hidden="true">
            {BURST.map((b, i) => (
              <span
                key={i}
                className="stamp-leaf"
                style={
                  {
                    "--dx": `${b.dx}px`,
                    "--dy": `${b.dy}px`,
                    "--rot": `${b.rot}deg`,
                    color: LEAF_COLORS[i % LEAF_COLORS.length],
                  } as CSSProperties
                }
              >
                <LeafSvg />
              </span>
            ))}
          </span>
        )}
        <span className={`stamp ${cls}`}>{label}</span>
      </span>
      {extra}
    </p>
  );
}
