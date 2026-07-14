import type { ModeId } from "../types";
import { MODE_LABELS } from "./ModeSelect";
import "../modeSelect.css";

export function ModeBar({ mode, onBack }: { mode: ModeId; onBack: () => void }) {
  return (
    <div className="mode-bar">
      <button className="mode-back" onClick={onBack}>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="mode-back-arrow">
          <path
            d="M14 5l-7 7 7 7"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        All modes
      </button>
      <span className="mode-bar-title">{MODE_LABELS[mode]}</span>
    </div>
  );
}
