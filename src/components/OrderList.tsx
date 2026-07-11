import type { ReactNode } from "react";

export interface OrderItem {
  name: string;
  first: boolean;
  current: boolean;
  done: boolean;
  who: ReactNode;
  nameExtra?: ReactNode;
}

export function OrderList({ items }: { items: OrderItem[] }) {
  return (
    <ul className="order-list">
      {items.map((item, i) => (
        <li
          key={i}
          className={[item.first && "first", item.current && "current", item.done && "done"]
            .filter(Boolean)
            .join(" ")}
        >
          {item.first ? "★ " : ""}
          {item.name}
          {item.nameExtra && <> {item.nameExtra}</>}
          <span className="who">{item.who}</span>
        </li>
      ))}
    </ul>
  );
}
