import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { imgSrc } from "../data/factions";
import { useLocalStorage } from "../lib/store";
import type { Faction } from "../types";

export interface RevealSeatItem {
  /** player at the table */
  name: string;
  faction: Faction;
  /** opens the game — gets the gold banner and the ★ */
  first?: boolean;
  /** one short flavor line under the faction name ("won by ticket", "their 1st choice", …) */
  note?: string;
}

/**
 * Full-screen "the woodland chooses" ceremony, played once over a mode's done
 * screen when its faction results come out of secret picks or the app's own
 * randomness. Face-down cards flip seat by seat under falling autumn leaves;
 * tap anywhere to hurry a flip, skip the whole thing, or replay it later.
 *
 * The seat-by-seat reveal itself runs for everyone — prefers-reduced-motion
 * only strips the decorative motion in CSS (falling leaves, the 3D turn, the
 * glow), turning each flip into an instant swap.
 *
 * A signature of the result is persisted on dismissal, so a page reload on the
 * done screen doesn't re-run the theatre — only a genuinely new result does.
 */
export function RevealCeremony({ storageKey, items }: { storageKey: string; items: RevealSeatItem[] }) {
  const signature = useMemo(() => JSON.stringify(items.map((s) => [s.name, s.faction.id, !!s.first])), [items]);
  const [seenSig, setSeenSig] = useLocalStorage<string | null>(`rootpicker.reveal.${storageKey}`, null);
  const [open, setOpen] = useState(() => seenSig !== signature);
  const [flipped, setFlipped] = useState(0);
  const allFlipped = flipped >= items.length;
  const continueRef = useRef<HTMLButtonElement>(null);

  // auto-flip one card at a time; the first beat holds a touch longer for the hush
  useEffect(() => {
    if (!open || allFlipped) return;
    const t = window.setTimeout(() => setFlipped((n) => n + 1), flipped === 0 ? 1600 : 1250);
    return () => window.clearTimeout(t);
  }, [open, flipped, allFlipped]);

  useEffect(() => {
    if (open && allFlipped) continueRef.current?.focus();
  }, [open, allFlipped]);

  // keep the parchment behind the ceremony from scrolling underneath it
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("ceremony-open");
    return () => document.body.classList.remove("ceremony-open");
  }, [open]);

  if (!items.length) return null;

  if (!open) {
    return (
      <p className="ceremony-replay-row">
        <button
          type="button"
          className="link-btn"
          onClick={() => {
            setFlipped(0);
            setOpen(true);
          }}
        >
          ✦ Replay the reveal
        </button>
      </p>
    );
  }

  return (
    <div
      className="ceremony"
      role="dialog"
      aria-modal="true"
      aria-label="Faction reveal"
      onClick={() => setFlipped((n) => Math.min(n + 1, items.length))}
    >
      <div className="ceremony-leaves" aria-hidden="true">
        {LEAVES.map((leaf, i) => (
          <span key={i} className="ceremony-leaf" style={leaf}>
            <LeafSvg />
          </span>
        ))}
      </div>
      <div className="ceremony-inner">
        <p className="ceremony-kicker">
          {allFlipped ? "Banners raised, daggers drawn — may the clearings favor you." : "A hush falls over the clearings…"}
        </p>
        <p className={`ceremony-title${allFlipped ? " done" : ""}`}>
          {allFlipped ? "The Clearings Have Chosen" : "The Woodland Chooses…"}
        </p>
        <div className="ceremony-cards">
          {items.map((s, i) => (
            <div
              key={i}
              className={[
                "ceremony-card",
                s.faction.type,
                i < flipped ? "flipped" : "",
                s.first ? "first" : "",
              ]
                .filter(Boolean)
                .join(" ")}
              style={{ "--i": i } as CSSProperties}
            >
              <div className="ceremony-card-inner">
                <div className="ceremony-face ceremony-back">
                  <SealSvg />
                </div>
                <div className="ceremony-face ceremony-front">
                  <p className="ceremony-player">
                    {s.first ? "★ " : ""}
                    {s.name}
                  </p>
                  <img src={imgSrc(s.faction)} alt="" />
                  <p className="ceremony-faction">{s.faction.name}</p>
                  <p className="ceremony-note">{s.note ?? `reach ${s.faction.reach} · ${s.faction.type}`}</p>
                  {s.first && <p className="ceremony-first-tag">first player</p>}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="ceremony-actions">
          {allFlipped ? (
            <button
              ref={continueRef}
              type="button"
              className="btn ceremony-continue"
              onClick={(e) => {
                e.stopPropagation();
                setSeenSig(signature);
                setOpen(false);
              }}
            >
              Onward to setup
            </button>
          ) : (
            <button
              type="button"
              className="link-btn ceremony-skip"
              onClick={(e) => {
                e.stopPropagation();
                setFlipped(items.length);
              }}
            >
              Skip the ceremony
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* Autumn palette off the app's own faction colors — the falling leaves. */
const LEAF_COLORS = ["#B08D2E", "#8C2B1E", "#5F7036", "#A6612B", "#6B5B40"];

/** Cheap deterministic pseudo-random in [0, 1) so the leaf field is stable across renders. */
function prand(i: number, salt: number): number {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

const LEAVES: CSSProperties[] = Array.from({ length: 16 }, (_, i) => ({
  // negative delay so the sky is already mid-fall when the ceremony opens
  "--x": `${(prand(i, 1) * 100).toFixed(1)}%`,
  "--delay": `${(-prand(i, 2) * 12).toFixed(2)}s`,
  "--dur": `${(8 + prand(i, 3) * 7).toFixed(2)}s`,
  "--sz": `${Math.round(13 + prand(i, 4) * 14)}px`,
  "--sway": `${Math.round(16 + prand(i, 5) * 30)}px`,
  "--sway-dur": `${(2.2 + prand(i, 6) * 2).toFixed(2)}s`,
  color: LEAF_COLORS[i % LEAF_COLORS.length],
})) as CSSProperties[];

function LeafSvg() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.5 3.5c-7.4-.5-12.9 1.9-15.4 6-1.9 3.1-1.7 6.9.2 9.4l-1.8 1.8 1.3 1.3 1.8-1.8c2.5 1.9 6.3 2.1 9.4.2 4.1-2.5 6.5-8 6-15.4z"
      />
      <path fill="none" stroke="rgba(35,44,26,.55)" strokeWidth="1.3" d="M6.5 17.5C9.5 13 13.5 9 18 6.5" />
    </svg>
  );
}

/** Woodland wax-seal for the card backs: a lone fir inside a double ring. */
function SealSvg() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="32" r="29" fill="none" stroke="currentColor" strokeWidth="2.5" />
      <circle cx="32" cy="32" r="24.5" fill="none" stroke="currentColor" strokeWidth="1" />
      <path fill="currentColor" d="M32 12 21.5 30h6.2L19 45h26L36.3 30h6.2L32 12z" />
      <rect x="29.8" y="45" width="4.4" height="7" fill="currentColor" />
    </svg>
  );
}
