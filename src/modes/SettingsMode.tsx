import { DEFAULT_OWNED_IDS, FACTIONS } from "../data/factions";
import { DEFAULT_OWNED_HIRELING_IDS, HIRELINGS, HIRELING_PACKS, hirelingImageSrc, type HirelingPackId } from "../data/hirelings";
import {
  DEFAULT_OWNED_VAGABOND_CHARACTER_IDS,
  VAGABOND_CHARACTERS,
  VAGABOND_CHARACTER_PACKS,
  vagabondCharacterImageSrc,
  type VagabondCharacterPackId,
} from "../data/vagabondCharacters";
import { useAppContext } from "../context/AppContext";
import { MAX_RAFFLE_TICKETS, MIN_RAFFLE_TICKETS } from "../lib/raffle";
import { MAX_DUTCH_RANGE, MAX_DUTCH_TICK_SECONDS, MIN_DUTCH_RANGE, MIN_DUTCH_TICK_SECONDS } from "../lib/dutch";
import { FactionCard } from "../components/FactionCard";
import { CardThumb } from "../components/CardThumb";

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
    dutchRange,
    setDutchRange,
    dutchTickSeconds,
    setDutchTickSeconds,
    ownedIds,
    setOwnedIds,
    ownedHirelingIds,
    setOwnedHirelingIds,
    ownedVagabondCharacterIds,
    setOwnedVagabondCharacterIds,
  } = useAppContext();

  const toggleOwned = (id: string) => {
    const next = new Set(ownedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOwnedIds(next);
  };

  const toggleHireling = (id: string) => {
    const next = new Set(ownedHirelingIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOwnedHirelingIds(next);
  };

  const toggleHirelingPack = (packId: HirelingPackId) => {
    const ids = HIRELINGS.filter((h) => h.pack === packId).map((h) => h.id);
    const allOwned = ids.every((id) => ownedHirelingIds.has(id));
    const next = new Set(ownedHirelingIds);
    ids.forEach((id) => (allOwned ? next.delete(id) : next.add(id)));
    setOwnedHirelingIds(next);
  };

  const toggleVagabondCharacter = (id: string) => {
    const next = new Set(ownedVagabondCharacterIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setOwnedVagabondCharacterIds(next);
  };

  const toggleVagabondCharacterPack = (packId: VagabondCharacterPackId) => {
    const ids = VAGABOND_CHARACTERS.filter((c) => c.pack === packId).map((c) => c.id);
    const allOwned = ids.every((id) => ownedVagabondCharacterIds.has(id));
    const next = new Set(ownedVagabondCharacterIds);
    ids.forEach((id) => (allOwned ? next.delete(id) : next.add(id)));
    setOwnedVagabondCharacterIds(next);
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

      <h2>Dutch Flower Auction</h2>
      <p className="note">
        How wide the price clock swings and how fast it ticks. The clock always runs from −range to +range VP.
      </p>
      <p className="note">Price range (±VP)</p>
      <div className="stepper">
        <button
          aria-label="Narrower range"
          disabled={dutchRange <= MIN_DUTCH_RANGE}
          onClick={() => setDutchRange(dutchRange - 1)}
        >
          −
        </button>
        <span className="count">±{dutchRange}</span>
        <button
          aria-label="Wider range"
          disabled={dutchRange >= MAX_DUTCH_RANGE}
          onClick={() => setDutchRange(dutchRange + 1)}
        >
          +
        </button>
      </div>
      <p className="note">Seconds per tick</p>
      <div className="stepper">
        <button
          aria-label="Faster clock"
          disabled={dutchTickSeconds <= MIN_DUTCH_TICK_SECONDS}
          onClick={() => setDutchTickSeconds(Math.round((dutchTickSeconds - 0.5) * 10) / 10)}
        >
          −
        </button>
        <span className="count">{dutchTickSeconds}s</span>
        <button
          aria-label="Slower clock"
          disabled={dutchTickSeconds >= MAX_DUTCH_TICK_SECONDS}
          onClick={() => setDutchTickSeconds(Math.round((dutchTickSeconds + 0.5) * 10) / 10)}
        >
          +
        </button>
      </div>

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

      <h2>Hireling Packs</h2>
      <p className="note">
        Which hirelings you own — the "Add Hirelings" step after any faction pick (Law A.6) deals only from what’s
        checked here. Tap a pack name to toggle it whole, or a single card if you're missing just one.
      </p>
      <div className="btn-row">
        <button className="btn secondary" onClick={() => setOwnedHirelingIds(new Set(DEFAULT_OWNED_HIRELING_IDS))}>
          Select all
        </button>
        <button className="btn secondary" onClick={() => setOwnedHirelingIds(new Set())}>
          Select none
        </button>
      </div>
      {HIRELING_PACKS.map((pack) => {
        const inPack = HIRELINGS.filter((h) => h.pack === pack.id);
        const ownedCount = inPack.filter((h) => ownedHirelingIds.has(h.id)).length;
        return (
          <div className="pack-group" key={pack.id}>
            <button
              className="pack-group-head"
              aria-pressed={ownedCount === inPack.length}
              onClick={() => toggleHirelingPack(pack.id)}
            >
              {pack.label} <span className="note">({ownedCount}/{inPack.length})</span>
            </button>
            <div className="pack-chip-row">
              {inPack.map((h) => {
                const has = ownedHirelingIds.has(h.id);
                return (
                  <button key={h.id} className="pack-chip" aria-pressed={has} onClick={() => toggleHireling(h.id)}>
                    <CardThumb src={hirelingImageSrc(h, false)} />
                    {h.promoted} / {h.demoted}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      <h2>Vagabond Characters</h2>
      <p className="note">
        Which Vagabond character cards you own — the character deal after any faction pick (Law A.8.2.III) draws
        only from what's checked here.
      </p>
      <div className="btn-row">
        <button
          className="btn secondary"
          onClick={() => setOwnedVagabondCharacterIds(new Set(DEFAULT_OWNED_VAGABOND_CHARACTER_IDS))}
        >
          Select all
        </button>
        <button className="btn secondary" onClick={() => setOwnedVagabondCharacterIds(new Set())}>
          Select none
        </button>
      </div>
      {VAGABOND_CHARACTER_PACKS.map((pack) => {
        const inPack = VAGABOND_CHARACTERS.filter((c) => c.pack === pack.id);
        const ownedCount = inPack.filter((c) => ownedVagabondCharacterIds.has(c.id)).length;
        return (
          <div className="pack-group" key={pack.id}>
            <button
              className="pack-group-head"
              aria-pressed={ownedCount === inPack.length}
              onClick={() => toggleVagabondCharacterPack(pack.id)}
            >
              {pack.label} <span className="note">({ownedCount}/{inPack.length})</span>
            </button>
            <div className="pack-chip-row">
              {inPack.map((c) => {
                const has = ownedVagabondCharacterIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    className="pack-chip"
                    aria-pressed={has}
                    onClick={() => toggleVagabondCharacter(c.id)}
                  >
                    <CardThumb src={vagabondCharacterImageSrc(c)} />
                    {c.name}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
