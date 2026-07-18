import { useEffect } from "react";
import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import {
  DUTCH_PREVIEW_MS,
  claimVP,
  dutchReducer,
  initialDutchState,
  normalizeVP,
  remainingSeats,
} from "../lib/dutch";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { SetupHero } from "../components/SetupHero";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

const formatPrice = (v: number) => (v > 0 ? `+${v}` : `${v}`);

export function DutchAuctionMode() {
  const {
    playerCount,
    availableFactions,
    playerNames,
    adventurous,
    setAdventurous,
    effTarget,
    dutchRange,
    dutchTickSeconds,
  } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.dutch", dutchReducer, initialDutchState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  // The component owns real time: a timeout ends each reveal's frozen
  // preview, and a timer re-arms itself after every tick to advance the
  // price. The reducer itself never reads a clock — it only reacts to the
  // BEGIN_CLOCK / TICK actions these effects dispatch.
  useEffect(() => {
    if (state.phase !== "auction" || !state.previewing || state.currentId === null) return;
    const t = setTimeout(() => dispatch({ type: "BEGIN_CLOCK" }), DUTCH_PREVIEW_MS);
    return () => clearTimeout(t);
  }, [state.phase, state.previewing, state.currentId, dispatch]);

  useEffect(() => {
    if (state.phase !== "auction" || state.previewing || state.currentId === null) return;
    if (state.price >= state.range) return; // holds at the cap — nothing left to schedule
    const t = setTimeout(() => dispatch({ type: "TICK" }), dutchTickSeconds * 1000);
    return () => clearTimeout(t);
  }, [state.phase, state.previewing, state.currentId, state.price, state.range, dutchTickSeconds, dispatch]);

  if (state.phase === "setup") {
    return (
      <section>
        <Explainer id="exp-dutch" summary="How this works">
          A live descending-clock auction, Dutch flower-market style. One faction sits on the block at a time.
          After a brief freeze so everyone can see what's up, the price starts at −{dutchRange} VP and ticks toward
          +{dutchRange} VP every {dutchTickSeconds}s — first player to tap <b>CLAIM</b> takes it at whatever price
          is showing that instant. Nobody's ever forced to buy: if no one claims it, the clock just holds at{" "}
          +{dutchRange} VP instead of guessing for you — waiting only ever costs you a cheaper price you already
          passed up. Once only one player is left without a faction, there's no one left to race against, so
          they're simply handed the last reveal at the full +{dutchRange} VP with no clock and no tap. Starting VP
          is a house rule, not from the Law — once everyone's set, the whole table's totals are shifted so the
          lowest sits at 0. Reach target and the Vagabond/Knaves exclusion (A.8.1) gate every reveal, same as
          Simple mode.
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order is randomized when you start — it only labels claims.</p>
        <NameInputs />
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button
            className="btn"
            onClick={() => {
              const deck = shuffleArr(availableFactions.filter((f) => f.id !== "vagabond2").map((f) => f.id));
              dispatch({
                type: "START",
                seats: shuffleArr(playerNames().slice()),
                deck,
                pool: availableFactions,
                target: effTarget,
                range: dutchRange,
              });
            }}
          >
            Shuffle seats &amp; start the clock
          </button>
        </div>
      </section>
    );
  }

  if (state.phase === "auction") {
    const faction = state.currentId ? byId[state.currentId] : null;
    const openSeats = remainingSeats(state.seats.length, state.claims);
    const priceCls = state.price < 0 ? "bad" : state.price === 0 ? "adventurous" : "ok";
    const trackPct = ((state.price + state.range) / (state.range * 2)) * 100;

    const orderItems: OrderItem[] = state.seats.map((name, i) => {
      const claim = state.claims.find((c) => c.seatIndex === i);
      return {
        name,
        first: i === 0,
        current: !claim,
        done: !!claim,
        who: claim ? `${byId[claim.id].name} — ${formatPrice(claim.price)} VP` : "watching the clock",
      };
    });

    return (
      <section>
        <h2>The Table</h2>
        <OrderList items={orderItems} />
        {faction && (
          <>
            <div className="picker-banner">
              {state.previewing ? (
                <>
                  <b>{faction.name}</b> is on the block — get ready, the clock starts in a moment.
                </>
              ) : (
                <>
                  Clock's running on <b>{faction.name}</b> — first to tap <b>CLAIM</b> takes it at the price
                  showing.
                </>
              )}
            </div>
            <div className="grid">
              {/* key remounts on each fresh reveal so the card flips in */}
              <div className="bounty-flip" key={faction.id}>
                <FactionCard faction={faction} reachBadge cornerTag />
              </div>
            </div>
            <div className="dutch-clock">
              <span className={`stamp ${priceCls}`}>{formatPrice(state.price)} VP</span>
              <div className="dutch-track">
                <div className={`dutch-track-fill ${priceCls}`} style={{ width: `${trackPct}%` }} />
              </div>
              <div className="dutch-track-labels">
                <span>{formatPrice(-state.range)} VP</span>
                <span>{formatPrice(state.range)} VP</span>
              </div>
            </div>
            <div className="dutch-claim-row">
              {openSeats.map((seatIndex) => (
                <button
                  key={seatIndex}
                  className="btn dutch-claim-btn"
                  disabled={state.previewing}
                  onClick={() =>
                    dispatch({
                      type: "CLAIM",
                      seatIndex,
                      price: state.price,
                      pool: availableFactions,
                      target: effTarget,
                    })
                  }
                >
                  {state.seats[seatIndex]} — CLAIM
                </button>
              ))}
            </div>
          </>
        )}
        {state.log.length > 0 && (
          <ul className="reveal-log">
            {state.log
              .slice(-6)
              .reverse()
              .map((entry, i) => (
                <li key={state.log.length - i}>
                  {state.seats[entry.seatIndex]} claims {byId[entry.id].name} for {formatPrice(entry.price)} VP
                  {entry.auto ? " — last seat, auto-resolved at the cap" : ""}
                </li>
              ))}
          </ul>
        )}
        <div className="btn-row">
          <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo last claim
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const normalized = normalizeVP(state.claims);
  const total = state.claims.reduce((s, c) => s + byId[c.id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(state.claims.map((c) => c.id));
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const idx = state.claims.findIndex((c) => c.seatIndex === i);
    const claim = state.claims[idx];
    const f = byId[claim.id];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === 0 ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type} · claimed at ${formatPrice(claimVP(claim))} VP · starts at +${normalized[idx]} VP (normalized)`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <p className="note">
        Track a starting-VP bonus by moving that player's score marker forward from “0” by their normalized total
        before the game begins — house rule, not from the Law.
      </p>
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="dutch" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="dutch" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="dutch" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
          Undo last claim
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
