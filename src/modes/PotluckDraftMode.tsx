import { useAppContext } from "../context/AppContext";
import { shuffleArr } from "../lib/shuffle";
import { reachBlockReason } from "../lib/reach";
import { pickBlockReason, potluckReducer, initialPotluckState } from "../lib/potluck";
import { usePersistedReducer } from "../lib/persistedReducer";
import { useEffectSkipFirst } from "../lib/useEffectSkipFirst";
import { byId, REACH_TARGET } from "../data/factions";
import { Explainer } from "../components/Explainer";
import { NameInputs } from "../components/NameInputs";
import { FactionCard } from "../components/FactionCard";
import { OrderList, type OrderItem } from "../components/OrderList";
import { SummaryList, type SummaryItem } from "../components/SummaryList";
import { SetupChecklist } from "../components/SetupChecklist";
import { ReachStampLine } from "../components/ReachStampLine";
import { ConfirmResetButton } from "../components/ConfirmResetButton";
import { HirelingSetup } from "../components/HirelingSetup";

export function PotluckDraftMode() {
  const { playerCount, availableFactions, playerNames, adventurous, setAdventurous, effTarget } = useAppContext();
  const [state, dispatch] = usePersistedReducer("rootpicker.session.potluck", potluckReducer, initialPotluckState);

  useEffectSkipFirst(() => {
    if (state.phase !== "setup") dispatch({ type: "RESET" });
  }, [playerCount, availableFactions]);

  if (state.phase === "setup") {
    return (
      <section>
        <h2>Seats</h2>
        <p className="note">Names are optional. Seating order is randomized when you start.</p>
        <NameInputs />
        <Explainer id="exp-potluck" summary="How this works">
          In seat order, each player adds one faction to a shared pool — open information, so everyone watches it
          grow. Reach target, the Vagabond/Knaves exclusion (A.8.1), and Second Vagabond gating are enforced on
          every addition, same as Simple mode. Then, in reverse seat order, each player takes one faction from
          that pool — with a single rule: never the one you brought yourself. The app blocks any pick that would
          leave a later picker stuck with nothing but their own contribution, checking the whole remaining table,
          not just the very last seat. Whoever picks last goes first in the real game, same compensation as
          Advanced Draft and Teaching Tiers — and here that's always the same seat that contributed first. Fair
          warning for two-player groups: with only two of you, this always degenerates into a straight swap — you
          play what they brought, they play what you brought. That's just the math of a group of two; enjoy it.
          This whole structure is a house rule, not from the Law.
        </Explainer>
        <label className="note" style={{ display: "block" }}>
          <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} />{" "}
          Adventurous group — allow any mix that reaches 17+
        </label>
        <div className="btn-row">
          <button className="btn" onClick={() => dispatch({ type: "START", seats: shuffleArr(playerNames().slice()) })}>
            Shuffle seats &amp; start the potluck
          </button>
        </div>
      </section>
    );
  }

  const firstSeat = state.pickOrder.length ? state.pickOrder[state.pickOrder.length - 1] : 0;

  if (state.phase === "contribute") {
    const currentSeat = state.contributions.length;
    const orderItems: OrderItem[] = state.seats.map((name, i) => {
      const contributed = i < state.contributions.length;
      const isCurrent = i === currentSeat;
      return {
        name,
        first: i === 0,
        current: isCurrent,
        done: contributed,
        who: contributed ? byId[state.contributions[i]].name : isCurrent ? "up now" : `turn ${i + 1}`,
      };
    });
    const contributedSet = new Set(state.contributions);

    return (
      <section>
        <h2>Turn Order</h2>
        <OrderList items={orderItems} />

        <h2>The Shared Pool</h2>
        <div className="picker-banner">
          <b>{state.seats[currentSeat]}</b> — add one faction to the pool. You won't be the one playing it.
        </div>
        <div className="grid">
          {availableFactions.map((f) => {
            const already = contributedSet.has(f.id);
            const reason = already ? null : reachBlockReason(contributedSet, f.id, state.seats.length, availableFactions, effTarget);
            const contributorIdx = state.contributions.indexOf(f.id);
            return (
              <FactionCard
                key={f.id}
                faction={f}
                reachBadge
                cornerTag
                takenBy={already ? state.seats[contributorIdx] : undefined}
                dimmed={already || !!reason}
                disabled={already || !!reason}
                title={already ? undefined : (reason ?? undefined)}
                onClick={() =>
                  dispatch({ type: "CONTRIBUTE", id: f.id, available: availableFactions, target: effTarget })
                }
              />
            );
          })}
        </div>

        <div className="btn-row">
          <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  if (state.phase === "pick") {
    const seatIndex = state.pickOrder[state.picks.length];
    const orderItems: OrderItem[] = state.seats.map((name, i) => {
      const pick = state.picks.find((p) => p.seatIndex === i);
      const isCurrent = i === seatIndex;
      return {
        name,
        first: i === firstSeat,
        current: isCurrent,
        done: !!pick,
        who: pick ? byId[pick.id].name : isCurrent ? "up now" : `turn ${i + 1}`,
      };
    });

    return (
      <section>
        <h2>Turn Order</h2>
        <OrderList items={orderItems} />

        <h2>Take a Faction</h2>
        <div className="picker-banner">
          <b>{state.seats[seatIndex]}</b> picks now — anything in the pool except{" "}
          <b>{byId[state.contributions[seatIndex]].name}</b>, the one you brought.
        </div>
        <div className="grid">
          {state.pool.map((id) => {
            const f = byId[id];
            const reason = pickBlockReason(seatIndex, id, state.pool, state.contributions, state.pickOrder, state.picks.length);
            return (
              <FactionCard
                key={id}
                faction={f}
                reachBadge
                cornerTag
                dimmed={!!reason}
                disabled={!!reason}
                title={reason ?? undefined}
                onClick={() => dispatch({ type: "PICK", id })}
              />
            );
          })}
        </div>

        <div className="btn-row">
          <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
            Undo last pick
          </button>
          <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>Start over</ConfirmResetButton>
        </div>
      </section>
    );
  }

  // done
  const total = state.picks.reduce((s, p) => s + byId[p.id].reach, 0);
  const rec = REACH_TARGET[playerCount];
  const finalFactionIds = new Set(state.picks.map((p) => p.id));
  const summaryItems: SummaryItem[] = state.seats.map((name, i) => {
    const pick = state.picks.find((p) => p.seatIndex === i)!;
    const f = byId[pick.id];
    const brought = byId[state.contributions[i]];
    return {
      img: `assets/factions/${f.img ?? f.id}.png`,
      primary: (
        <>
          {i === firstSeat ? "★ " : ""}
          {name} — {f.name}
        </>
      ),
      sub: `brought ${brought.name} · reach ${f.reach} · ${f.type}`,
    };
  });

  return (
    <section>
      <h2>The Woodland is Set</h2>
      <ReachStampLine total={total} recommended={rec} />
      <SummaryList items={summaryItems} />
      <h2>Before You Begin</h2>
      <SetupChecklist variant="standard" />
      <HirelingSetup storageKey="potluck" finalFactionIds={finalFactionIds} />
      <div className="btn-row">
        <button className="btn secondary" disabled={!state.past.length} onClick={() => dispatch({ type: "UNDO" })}>
          Undo last pick
        </button>
        <ConfirmResetButton onConfirm={() => dispatch({ type: "RESET" })}>New game</ConfirmResetButton>
      </div>
    </section>
  );
}
