import type { ReactNode } from "react";
import { reachVerdict } from "../lib/reach";

export function ReachStampLine({ total, recommended, extra }: { total: number; recommended: number; extra?: ReactNode }) {
  const { cls, label } = reachVerdict(total, recommended);
  return (
    <p>
      Reach <b>{total}</b> / {recommended} recommended &nbsp;
      <span className={`stamp ${cls}`}>{label}</span>
      {extra}
    </p>
  );
}
