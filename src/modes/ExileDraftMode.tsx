import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { banBlockReason, exileReducer, initialExileState, legalLineups } from "../lib/exile";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { GridLegend } from "../components/GridLegend";
import { SetupHero } from "../components/SetupHero";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { RevealCeremony, type RevealSeatItem } from "../components/RevealCeremony";
import { HirelingSetup } from "../components/HirelingSetup";
import { VagabondCharacterSetup } from "../components/VagabondCharacterSetup";
import { KnaveCaptainSetup } from "../components/KnaveCaptainSetup";

export function ExileDraftMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.exile", exileReducer, initialExileState);

  // Second Vagabond isn't a separately bannable faction — same convention as
  // every other faction-picking mode.
  const exilePool = availableFactions.filter((f) => f.id !== "vagabond2");

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    const startLegal = legalLineups(exilePool.map((f) => f.id), playerCount, effTarget);
    const canStart = exilePool.length >= playerCount && startLegal.length > 0;

    return (
      <section>
        <Explainer id="exp-exile" summary="How this works">
          Nobody drafts a faction here — everyone exiles them instead. In a random snake order, each player banishes
          one faction from the shared pool, round by round, until only <b>playerCount + 2</b> factions survive —
          enough slack that the app can always still deal a legal table. A ban is blocked if it would leave no
          reach-safe, at-least-one-militant, Vagabond/Knaves-safe lineup for the group. Once the last ban lands, the
          app rolls a random legal lineup from the survivors and randomly assigns it to seats — reveal all at once.
          Nobody controls their own faction, so every ban is pure preference: ban what you hate playing, or ban what
          you fear facing — you can't do both. If the bans don't split evenly across the table, whoever banned
          fewest times gets first pick of compensation: priority for the first-player seat. This whole structure is
          a house rule, not from the Law, and it changes no scoring.
        </Explainer>
        <SetupHero />
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order and ban order are randomized when you start.</p>
        <NameInputs />
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        {!canStart && (
          <p className="note">
            Not enough owned factions to guarantee a legal lineup for {playerCount} players — own more factions or
            try the adventurous toggle.
          </p>
        )}
        <div className="btn-row">
          <button
            className="btn"
            disabled={!canStart}
            onClick={() =>
              dispatch({
                type: "START",
                seats: shuffleArr(playerNames().slice()),
                pool: exilePool.map((f) => f.id),
              })
            }
          >
            Shuffle seats &amp; start exiling
          </button>
        </div>
      </section>
    );
  }

  const currentTurn = state.bans.length;
  const currentSeat = state.banOrder[currentTurn];
  const orderItems: OrderItem[] = state.seats.map((name, i) => {
    const made = state.bans.filter((b) => b.seatIndex === i).length;
    const owed = state.banOrder.filter((s) => s === i).length;
    const isCurrent = state.phase === "ban" && i === currentSeat;
    return {
      name,
      first: state.phase === "done" ? i === state.firstSeat : false,
      current: isCurrent,
      done: owed > 0 && made === owed,
      who:
        state.phase === "done"
          ? byId[state.assign[i]].name
          : isCurrent
            ? "exiling now"
            : owed === 0
              ? "no bans owed"
              : `${made}/${owed} bans made`,
    };
  });

  if (state.phase === "ban") {
    return (
      <section>
        <h2>Ban Order</h2>
        <OrderList items={orderItems} />

        <h2>The Shared Pool</h2>
        <div className="picker-banner">
          <b>{state.seats[currentSeat]}</b> — exile one faction from the pool. Ban {currentTurn + 1} of{" "}
          {state.banOrder.length}.
        </div>
        <GridLegend />
        <div className="grid">
          {exilePool.map((f) => {
            const ban = state.bans.find((b) => b.id === f.id);
            const reason = ban ? null : banBlockReason(state.pool, f.id, state.seats.length, effTarget);
            return (
              <FactionCard
                key={f.id}
                faction={f}
                reachBadge
                cornerTag
                takenBy={ban ? state.seats[ban.seatIndex] : undefined}
                dimmed={!!ban || !!reason}
                disabled={!!ban || !!reason}
                title={ban ? undefined : (reason ?? undefined)}
                onClick={() => dispatch({ type: "BAN", id: f.id, target: effTarget })}
              />
            );
          })}
        </div>

        <div className="btn-row">
          <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo last exile
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  if (state.phase === "revealReady") {
    const legal = legalLineups(state.pool, state.seats.length, effTarget);
    const survivors = state.pool.map((id) => byId[id]);
    return (
      <section>
        <h2>Ban Order</h2>
        <OrderList items={orderItems} />

        <h2>The Survivors</h2>
        <p className="note">
          Every ban is in — {survivors.length} factions survive for {state.seats.length} seats. The app deals the
          rest at random.
        </p>
        <GridLegend />
        <div className="grid">
          {survivors.map((f) => (
            <FactionCard key={f.id} faction={f} reachBadge cornerTag />
          ))}
        </div>

        {legal.length === 0 ? (
          <p className="note">
            No legal lineup survives — this shouldn't happen. Try the adventurous toggle, or start over.
          </p>
        ) : (
          <div className="btn-row">
            <button
              className="btn"
              onClick={() =>
                dispatch({
                  type: "DEAL",
                  target: effTarget,
                  index: Math.floor(Math.random() * legal.length),
                  seatOrder: shuffleArr(state.seats.map((_, i) => i)),
                })
              }
            >
              Reveal the Woodland
            </button>
          </div>
        )}
        <div className="btn-row">
          <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo last exile
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const total = state.assign.reduce((s, id) => s + byId[id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(state.assign);
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const f = byId[state.assign[i]];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === state.firstSeat ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `reach ${f.reach} · ${f.type}`,
    };
  });
  if (state.bans.length) {
    summaryItems.push({
      primary: "Exiled",
      sub: state.bans.map((b) => `${byId[b.id].name} (by ${state.seats[b.seatIndex]})`).join(", "),
      faded: true,
    });
  }
  const revealItems: RevealSeatItem[] = state.seats.map((name, i) => ({
    name,
    faction: byId[state.assign[i]],
    first: i === state.firstSeat,
    note: i === state.firstSeat ? "fewest bans — first player" : "dealt at random",
  }));

  return (
    <section>
      <RevealCeremony storageKey="exile" items={revealItems} />
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="exile" finalFactionIds={finalFactionIds} />
      <VagabondCharacterSetup storageKey="exile" finalFactionIds={finalFactionIds} />
      <KnaveCaptainSetup storageKey="exile" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
