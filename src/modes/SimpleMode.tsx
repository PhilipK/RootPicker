import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { byId } from "../data/factions";
import { reachBlockReason } from "../lib/reach";
import { usePersistedSet } from "../lib/store";
import { Explainer } from "../components/Explainer";
import { FactionCard } from "../components/FactionCard";
import { GridLegend } from "../components/GridLegend";
import { DisabledReasonNote } from "../components/DisabledReasonNote";
import { ReachTracker } from "../components/ReachTracker";
import { HirelingSetup } from "../components/HirelingSetup";

export function SimpleMode() {
  const { playerCount, availableFactions, adventurous, setAdventurous, effTarget } = useAppContext();
  const [selected, setSelected] = usePersistedSet("rootpicker.session.simple");
  const [tapReason, setTapReason] = useState<string | null>(null);

  useEffect(() => {
    const availIds = new Set(availableFactions.map((f) => f.id));
    setSelected((prev) => {
      const next = new Set([...prev].filter((id) => availIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [availableFactions]);

  const toggleFaction = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        if (id === "vagabond") next.delete("vagabond2"); // second card needs the first
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const blockReason = (id: string) => reachBlockReason(selected, id, playerCount, availableFactions, effTarget);

  const total = [...selected].reduce((s, id) => s + byId[id].reach, 0);
  const legal = selected.size === playerCount && total >= 17;

  return (
    <section>
      <Explainer id="exp-simple" summary="How this works">
        Everyone picks freely. The Law asks the chosen factions’ reach to add up to the recommended total for
        your player count (Law 5.2). Any mix of 17+ is allowed for adventurous groups.
      </Explainer>
      <label className="note" style={{ display: "block" }}>
        <input type="checkbox" checked={adventurous} onChange={(e) => setAdventurous(e.target.checked)} /> Adventurous
        group — allow any mix that reaches 17+
      </label>
      <GridLegend corner />
      <div className="grid">
        {availableFactions.map((f) => {
          const isSel = selected.has(f.id);
          const reason = isSel ? null : blockReason(f.id);
          return (
            <FactionCard
              key={f.id}
              faction={f}
              reachBadge
              cornerTag
              selected={isSel}
              ariaPressed={isSel}
              dimmed={!!reason}
              disabled={!!reason}
              title={reason ?? undefined}
              onClick={() => toggleFaction(f.id)}
              onDisabledTap={reason ? () => setTapReason(reason) : undefined}
            />
          );
        })}
      </div>
      <DisabledReasonNote reason={tapReason} onDismiss={() => setTapReason(null)} />
      <ReachTracker selectedIds={selected} />
      {legal && <HirelingSetup storageKey="simple" finalFactionIds={selected} />}
    </section>
  );
}
