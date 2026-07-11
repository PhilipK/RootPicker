import type { ReactNode } from "react";

export interface SummaryItem {
  img?: string;
  primary: ReactNode;
  sub: ReactNode;
  faded?: boolean;
}

export function SummaryList({ items }: { items: SummaryItem[] }) {
  return (
    <ul className="summary-list">
      {items.map((item, i) => (
        <li key={i} style={item.faded ? { opacity: 0.6 } : undefined}>
          {item.img && <img src={item.img} alt="" />}
          <div>
            <div className="fac">{item.primary}</div>
            <div className="sub">{item.sub}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}
