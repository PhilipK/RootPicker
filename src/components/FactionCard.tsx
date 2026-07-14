import type { ReactNode } from "react";
import { imgSrc } from "../data/factions";
import type { Faction } from "../types";

interface FactionCardProps {
  faction: Faction;
  reachBadge?: boolean;
  cornerTag?: boolean;
  lockBadge?: ReactNode;
  takenBy?: string;
  rankBadge?: number;
  selected?: boolean;
  selectedBan?: boolean;
  dimmed?: boolean;
  disabled?: boolean;
  ariaPressed?: boolean;
  title?: string;
  onClick?: () => void;
  /** Fired when a *disabled* card is tapped. The `disabled` attribute swallows
      the button's own click, so this is delivered through a wrapper instead —
      lets callers surface `title`'s reason somewhere visible on touch. */
  onDisabledTap?: () => void;
}

export function FactionCard({
  faction,
  reachBadge,
  cornerTag,
  lockBadge,
  takenBy,
  rankBadge,
  selected,
  selectedBan,
  dimmed,
  disabled,
  ariaPressed,
  title,
  onClick,
  onDisabledTap,
}: FactionCardProps) {
  const classes = ["card"];
  if (selected) classes.push("selected");
  if (selectedBan) classes.push("selected-ban");
  if (dimmed) classes.push("dimmed");
  if (lockBadge) classes.push("locked");
  if (takenBy) classes.push("taken");

  return (
    // display:contents in CSS — pure passthrough for grid layout. A disabled
    // <button> doesn't dispatch click at all, so the tap is caught here instead.
    <div className="card-slot" onClick={disabled && onDisabledTap ? onDisabledTap : undefined}>
      <button
        className={classes.join(" ")}
        disabled={disabled}
        title={title}
        aria-pressed={ariaPressed}
        onClick={onClick}
      >
        <div className="card-media">
          <img src={imgSrc(faction)} alt={`${faction.name} — ${faction.type}`} />
          {reachBadge && (
            <span className="reach-badge" title="Reach">
              {faction.reach}
            </span>
          )}
          {cornerTag && faction.corner && (
            <span className="corner-tag" title="Starts in a corner clearing">
              corner
            </span>
          )}
          {lockBadge && <span className="lock-badge">{lockBadge}</span>}
          {takenBy && <span className="taken-by">{takenBy}</span>}
          {rankBadge != null && <span className="rank-badge">#{rankBadge}</span>}
        </div>
        <div className="card-name">
          <span className="fname">{faction.name}</span>
          <span className={`t ${faction.type}`}>{faction.type[0].toUpperCase() + faction.type.slice(1)}</span>
        </div>
      </button>
    </div>
  );
}
