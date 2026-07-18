import type { ReactNode } from "react";
import type { ModeId } from "../types";
import { modeHasProgress } from "../lib/store";
import "../modeSelect.css";

/* ---------- icons ---------- *
 * One line-drawn glyph per mode, all in the same ink stroke style:
 * 24×24 box, currentColor stroke, round caps/joins, filled accents only
 * where the glyph naturally calls for a dot or a star.
 */
const strokeProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const fillDot = { fill: "currentColor", stroke: "none" };

function SimpleIcon() {
  // a die — pick freely, roll of the wheel
  return (
    <svg {...strokeProps}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3.5" />
      <circle cx="8" cy="8" r="1.15" {...fillDot} />
      <circle cx="16" cy="8" r="1.15" {...fillDot} />
      <circle cx="12" cy="12" r="1.15" {...fillDot} />
      <circle cx="8" cy="16" r="1.15" {...fillDot} />
      <circle cx="16" cy="16" r="1.15" {...fillDot} />
    </svg>
  );
}

function DraftIcon() {
  // a shared deck / pool dealt to the table
  return (
    <svg {...strokeProps}>
      <rect x="4" y="9" width="16" height="11" rx="1.6" />
      <path d="M6.5 6.5h11" />
      <path d="M8 4h8" />
    </svg>
  );
}

function HandIcon() {
  // a fanned hand of cards
  return (
    <svg {...strokeProps}>
      <rect x="9.5" y="6" width="5" height="15" rx="1" transform="rotate(-22 12 21)" />
      <rect x="9.5" y="6" width="5" height="15" rx="1" />
      <rect x="9.5" y="6" width="5" height="15" rx="1" transform="rotate(22 12 21)" />
    </svg>
  );
}

function FavBanIcon() {
  // a heart (favorite) beside a struck-through circle (ban)
  return (
    <svg {...strokeProps}>
      <path d="M8 12.4C5.5 10.5 4 9.2 4 7.5 4 6.1 5 5.1 6.3 5.1c.8 0 1.4.4 1.7 1 .3-.6.9-1 1.7-1C11 5.1 12 6.1 12 7.5c0 1.7-1.5 3-4 4.9z" />
      <circle cx="16" cy="15" r="3.4" />
      <path d="M13.6 12.6l4.8 4.8" />
    </svg>
  );
}

function CutIcon() {
  // balance scales — one player weighs the lineup
  return (
    <svg {...strokeProps}>
      <path d="M12 5v14" />
      <path d="M8 19h8" />
      <path d="M5 8h14" />
      <path d="M5 8l-2 3" />
      <path d="M5 8l2 3" />
      <path d="M3 11a2 2 0 0 0 4 0" />
      <path d="M19 8l-2 3" />
      <path d="M19 8l2 3" />
      <path d="M17 11a2 2 0 0 0 4 0" />
    </svg>
  );
}

function AuctionIcon() {
  // an auctioneer's gavel over its block
  return (
    <svg {...strokeProps}>
      <rect x="11.5" y="4.8" width="8" height="4.4" rx="1.4" transform="rotate(-40 15.5 7)" />
      <path d="M13.2 9.4 8.2 14.4" />
      <path d="M5 19.5h8" />
      <path d="M6.5 17.5h5" />
    </svg>
  );
}

function BountyIcon() {
  // a growing stack of coins — the bounty piles up
  return (
    <svg {...strokeProps}>
      <ellipse cx="12" cy="6.5" rx="6" ry="2.4" />
      <path d="M6 6.5v3.8c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4V6.5" />
      <path d="M6 10.3v3.8c0 1.3 2.7 2.4 6 2.4s6-1.1 6-2.4v-3.8" />
    </svg>
  );
}

function TeachingIcon() {
  // a graduate's mortarboard
  return (
    <svg {...strokeProps}>
      <path d="M12 5 2.5 9 12 13 21.5 9 12 5z" />
      <path d="M6.5 10.9V15c0 1.2 2.5 2.2 5.5 2.2s5.5-1 5.5-2.2v-4.1" />
      <path d="M21.5 9v4.4" />
      <circle cx="21.5" cy="14.4" r=".85" {...fillDot} />
    </svg>
  );
}

function WishIcon() {
  // a ranked list topped by a star
  return (
    <svg {...strokeProps}>
      <path d="M7 3.6l1.3 2.7 2.9.4-2.1 2 .5 2.9L7 10.2 4.5 11.6l.5-2.9-2.1-2 2.9-.4L7 3.6z" />
      <path d="M13.5 6.5h6.5" />
      <path d="M13.5 10h6.5" />
      <path d="M4 15h16" />
      <path d="M4 18.5h16" />
    </svg>
  );
}

function PotluckIcon() {
  // a shared cooking pot with steam — everyone contributes, no one eats what they made
  return (
    <svg {...strokeProps}>
      <path d="M5 11h14l-1.3 7.3a2 2 0 0 1-2 1.7H8.3a2 2 0 0 1-2-1.7L5 11z" />
      <path d="M3.5 11h17" />
      <path d="M9 8.6c.9-1.5 2.4-1.5 3.2 0" />
      <path d="M14.2 8.6c.9-1.5 2.4-1.5 3.2 0" />
    </svg>
  );
}

function TradeIcon() {
  // two arrows chasing each other in a circle — a trading cycle
  return (
    <svg {...strokeProps}>
      <path d="M6.5 9a6.5 6.5 0 0 1 11-1.5" />
      <path d="M17.5 4v3.5H14" />
      <path d="M17.5 15a6.5 6.5 0 0 1-11 1.5" />
      <path d="M6.5 20v-3.5H10" />
    </svg>
  );
}

function RaffleIcon() {
  // a raffle ticket with a perforated edge
  return (
    <svg {...strokeProps}>
      <path d="M3.5 8.5a2 2 0 0 0 0 7V19h17v-3.5a2 2 0 0 1 0-7V5h-17v3.5z" />
      <path d="M14.5 6.5v1.6M14.5 10v1.6M14.5 13.4v1.6M14.5 16.8v1.6" strokeDasharray="0.1 2.6" />
    </svg>
  );
}

function RouletteIcon() {
  // a spinning wheel with a fixed pointer at the top — spin, veto, respin
  return (
    <svg {...strokeProps}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 5v8l5.2 3" />
      <circle cx="12" cy="13" r="1.1" {...fillDot} />
      <path d="M10.5 2.2h3L12 5z" {...fillDot} />
    </svg>
  );
}

function ExileIcon() {
  // a struck-through circle (banned) with an arrow casting it out of the pool
  return (
    <svg {...strokeProps}>
      <circle cx="9" cy="12" r="5.4" />
      <path d="M5.4 8.4l7.2 7.2" />
      <path d="M14.5 12h6" />
      <path d="M17.7 9l2.8 3-2.8 3" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg {...strokeProps}>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M12 2.8v2.5M12 18.7v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.8 12h2.5M18.7 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8" />
    </svg>
  );
}

export interface ModeMeta {
  id: ModeId;
  label: string;
  icon: ReactNode;
  /** one-line plain description of what the mode does */
  desc: string;
  /** the table this mode is the right pick for */
  best: string;
  /** true for modes that add scoring not found in the Law of Root */
  houseRule?: boolean;
}

/** Game modes, in the reading order of the old tab strip. Settings is kept out
 *  on purpose — it is offered separately at the foot of the landing screen. */
export const GAME_MODES: ModeMeta[] = [
  {
    id: "simple",
    label: "Simple Setup",
    icon: <SimpleIcon />,
    desc: "Pick any factions you like; the tracker keeps a running reach total and flags when the table is off balance.",
    best: "groups who already know what they want to play",
  },
  {
    id: "draft",
    label: "Advanced Draft",
    icon: <DraftIcon />,
    desc: "Deal one shared pool, then pick down the line from the last seat backward, setting up your faction as you go.",
    best: "the official randomized draft, straight from the Law's appendix",
  },
  {
    id: "hand",
    label: "Hand Draft",
    icon: <HandIcon />,
    desc: "Deal each player a secret hand of factions, keep one, and pass the device to the next seat.",
    best: "a fast draft where no one sees the whole pool",
  },
  {
    id: "fav",
    label: "Favorite & Ban",
    icon: <FavBanIcon />,
    desc: "Secretly lock a faction to yourself or ban one from the table, reveal all at once, then draft the survivors.",
    best: "tables with a faction someone loves or can't stand",
  },
  {
    id: "cut",
    label: "Cut & Choose",
    icon: <CutIcon />,
    desc: "One Warden builds the lineup; everyone else claims a faction first, and the Warden plays whatever is left.",
    best: "putting the balance in one trusted player's hands",
  },
  {
    id: "auction",
    label: "Riverfolk Auction",
    icon: <AuctionIcon />,
    desc: "Secretly bid victory points for first pick; whoever bids low starts the game holding the points they kept.",
    best: "trading away board position for a scoring head start",
    houseRule: true,
  },
  {
    id: "bounty",
    label: "Bounty Draft",
    icon: <BountyIcon />,
    desc: "Factions reveal one at a time. Claim the one on offer with the VP piled on it, or pass and add to the pile.",
    best: "a game of nerve over who takes the bait first",
    houseRule: true,
  },
  {
    id: "tt",
    label: "Teaching Tiers",
    icon: <TeachingIcon />,
    desc: "Newer players pick first from gentle factions, veterans pick last, then turn order flips to even the odds.",
    best: "mixed tables showing Root to first-timers",
  },
  {
    id: "wish",
    label: "Wishlist",
    icon: <WishIcon />,
    desc: "Everyone secretly ranks their favorites; the app searches for the assignment that makes the whole table happiest.",
    best: "when everyone has opinions but no one wants to haggle",
  },
  {
    id: "potluck",
    label: "Potluck Draft",
    icon: <PotluckIcon />,
    desc: "Everyone adds one faction to a shared pool in turn, then drafts it in reverse order — just never the one they brought.",
    best: "open-information tables who like the twist of never playing their own pick",
  },
  {
    id: "trade",
    label: "Trading Post",
    icon: <TradeIcon />,
    desc: "Everyone is dealt a secret faction, ranks what they'd rather play, and the app trades wishes around in cycles.",
    best: "getting everyone an upgrade without anyone haggling",
  },
  {
    id: "raffle",
    label: "Woodland Raffle",
    icon: <RaffleIcon />,
    desc: "Spread ten secret tickets across the factions you want, then watch the urn draw winners one ticket at a time.",
    best: "gamblers who'd rather bet on a faction than argue for it",
  },
  {
    id: "roulette",
    label: "Woodland Roulette",
    icon: <RouletteIcon />,
    desc: "The app spins a fully random legal lineup; anyone can veto one faction to exile it and force a re-spin.",
    best: "groups who trust the wheel more than each other's opinions, with one shared escape hatch",
  },
  {
    id: "exile",
    label: "Exile Draft",
    icon: <ExileIcon />,
    desc: "Nobody picks — everyone bans down the shared pool in turn, then the app deals a random legal lineup from what survives.",
    best: "tables who trust the dice more than each other's picks",
  },
];

export const SETTINGS_META: Pick<ModeMeta, "id" | "label" | "icon"> = {
  id: "settings",
  label: "Settings",
  icon: <GearIcon />,
};

/** Lookup used by the ModeBar to name the active mode. */
export const MODE_LABELS: Record<ModeId, string> = {
  ...Object.fromEntries(GAME_MODES.map((m) => [m.id, m.label])),
  settings: SETTINGS_META.label,
} as Record<ModeId, string>;

export function ModeSelect({ onSelect }: { onSelect: (m: ModeId) => void }) {
  return (
    <section className="mode-select">
      <p className="mode-select-intro">
        Thirteen ways to seat the Woodland. Choose how your table settles on factions.
      </p>

      <ul className="mode-grid">
        {GAME_MODES.map((m) => {
          const inProgress = modeHasProgress(m.id);
          return (
            <li key={m.id}>
              <button className="mode-card" onClick={() => onSelect(m.id)}>
                <span className="mode-card-icon">{m.icon}</span>
                <span className="mode-card-body">
                  <span className="mode-card-head">
                    <span className="mode-card-name">{m.label}</span>
                    {m.houseRule && <span className="mode-tag house">house rule</span>}
                    {inProgress && <span className="mode-tag progress">in progress</span>}
                  </span>
                  <span className="mode-card-desc">{m.desc}</span>
                  <span className="mode-card-best">
                    <span className="mode-card-best-label">Best for</span> {m.best}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <div className="mode-settings-row">
        <button className="mode-settings-link" onClick={() => onSelect("settings")}>
          <span className="mode-settings-icon">{SETTINGS_META.icon}</span>
          Settings
          <span className="mode-settings-sub">factions you own, wishlist size, table preferences</span>
        </button>
      </div>
    </section>
  );
}
