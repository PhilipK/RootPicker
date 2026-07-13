import type { ModeId } from "../types";

const TABS: { id: ModeId; label: string }[] = [
  { id: "simple", label: "Simple Setup" },
  { id: "draft", label: "Advanced Draft" },
  { id: "hand", label: "Hand Draft" },
  { id: "fav", label: "Favorite & Ban" },
  { id: "cut", label: "Cut & Choose" },
  { id: "auction", label: "Riverfolk Auction" },
  { id: "bounty", label: "Bounty Draft" },
  { id: "tt", label: "Teaching Tiers" },
  { id: "wish", label: "Wishlist" },
  { id: "settings", label: "Settings" },
];

export function Nav({ mode, onChange }: { mode: ModeId; onChange: (m: ModeId) => void }) {
  return (
    <nav role="tablist">
      {TABS.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={mode === t.id}
          onClick={() => onChange(t.id)}
        >
          {t.label}
        </button>
      ))}
    </nav>
  );
}
