import type { ReactNode } from "react";
import { useExplainerOpen } from "../lib/store";

export function Explainer({ id, summary, children }: { id: string; summary: string; children: ReactNode }) {
  const [open, setOpen] = useExplainerOpen(id);
  return (
    <details className="explainer" open={open} onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>{summary}</summary>
      <p className="note">{children}</p>
    </details>
  );
}
