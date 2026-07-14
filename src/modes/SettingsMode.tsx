import { DEFAULT_OWNED_IDS, FACTIONS } from "../data/factions";
import { useAppContext } from "../context/AppContext";
import { MAX_RAFFLE_TICKETS, MIN_RAFFLE_TICKETS } from "../lib/raffle";
import { FactionCard } from "../components/FactionCard";

export function SettingsMode() {
  const {
    viewMode,
    setViewMode,
    wishCount,
    setWishCount,
    raffleTicketCount,
    raffleTicketCountIsAuto,
    setRaffleTicketCount,
    resetRaffleTicketCount,
    ownedIds,
    setOwnedIds,
  } = useAppContext();

  const toggleOwned = (id: string) => {
    const next = new Set(ownedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOwnedIds(next);
  };

  return (
    <section>
      <h2>Display</h2>
      <p className="note">Switch between full art cards and a compact list — the list scans faster on a phone.</p>
      <div className="view-toggle-row">
        <button
          className="link-btn"
          aria-pressed={viewMode === "list"}
          onClick={() => setViewMode(viewMode === "list" ? "grid" : "list")}
        >
          {viewMode === "list" ? "▦ Card view" : "☰ List view"}
        </button>
      </div>

      <h2>Wishlist</h2>
      <p className="note">
        How many factions each player ranks in Wishlist mode. Points double with each better rank, so the top pick
        is always worth the most.
      </p>
      <div className="stepper">
        <button aria-label="Fewer picks" disabled={wishCount <= 1} onClick={() => setWishCount(wishCount - 1)}>
          −
        </button>
        <span className="count">{wishCount}</span>
        <button aria-label="More picks" disabled={wishCount >= 5} onClick={() => setWishCount(wishCount + 1)}>
          +
        </button>
      </div>

      <h2>Woodland Raffle</h2>
      <p className="note">
        How many tickets each player gets to spread across factions.{" "}
        {raffleTicketCountIsAuto ? (
          <>Matches your player count until you change it here.</>
        ) : (
          <>Fixed at this number regardless of player count.</>
        )}
      </p>
      <div className="stepper">
        <button
          aria-label="Fewer tickets"
          disabled={raffleTicketCount <= MIN_RAFFLE_TICKETS}
          onClick={() => setRaffleTicketCount(raffleTicketCount - 1)}
        >
          −
        </button>
        <span className="count">{raffleTicketCount}</span>
        <button
          aria-label="More tickets"
          disabled={raffleTicketCount >= MAX_RAFFLE_TICKETS}
          onClick={() => setRaffleTicketCount(raffleTicketCount + 1)}
        >
          +
        </button>
      </div>
      {!raffleTicketCountIsAuto && (
        <div className="btn-row">
          <button className="btn secondary" onClick={resetRaffleTicketCount}>
            Match player count again
          </button>
        </div>
      )}

      <h2>Your Collection</h2>
      <p className="note">
        Uncheck anything you don’t own. Every mode above deals only from what’s checked here — stored on this
        device, nowhere else.
      </p>
      <div className="btn-row">
        <button className="btn secondary" onClick={() => setOwnedIds(new Set(DEFAULT_OWNED_IDS))}>
          Select all
        </button>
        <button className="btn secondary" onClick={() => setOwnedIds(new Set())}>
          Select none
        </button>
      </div>
      <div className="grid">
        {FACTIONS.filter((f) => f.id !== "vagabond2").map((f) => {
          const has = ownedIds.has(f.id);
          return (
            <FactionCard
              key={f.id}
              faction={f}
              ariaPressed={has}
              lockBadge={has ? undefined : "Not owned — tap to include"}
              onClick={() => toggleOwned(f.id)}
            />
          );
        })}
      </div>
    </section>
  );
}
