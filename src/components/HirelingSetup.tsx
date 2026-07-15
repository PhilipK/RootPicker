import { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { demoteCount, drawHirelings, eligibleHirelings } from "../lib/hirelingDraw";
import { useHirelingDraw } from "../lib/store";
import { byHirelingId } from "../data/hirelings";
import { Explainer } from "./Explainer";
import { SummaryList, type SummaryItem } from "./SummaryList";

function fingerprintOf(finalFactionIds: Set<string>, ownedHirelingIds: Set<string>, playerCount: number): string {
  return JSON.stringify([[...finalFactionIds].sort(), [...ownedHirelingIds].sort(), playerCount]);
}

function demoteNote(playerCount: number): string {
  const n = demoteCount(playerCount);
  if (n === 0) return `At ${playerCount} players, none of the three get demoted.`;
  return `At ${playerCount} players, ${n} of the three get flipped to their Demoted side.`;
}

/** The optional "Add Hirelings" step (Law A.6), dropped into the done screen
    of every faction-picking mode. One draw is stashed per `storageKey` (the
    calling mode's id) and self-invalidates if the final lineup, owned packs,
    or player count change out from under it — e.g. after Undo/Start over. */
export function HirelingSetup({ storageKey, finalFactionIds }: { storageKey: string; finalFactionIds: Set<string> }) {
  const { playerCount, ownedHirelingIds } = useAppContext();
  const [stored, setStored] = useHirelingDraw(storageKey);

  const fingerprint = useMemo(
    () => fingerprintOf(finalFactionIds, ownedHirelingIds, playerCount),
    [finalFactionIds, ownedHirelingIds, playerCount],
  );
  const valid = stored && stored.fingerprint === fingerprint ? stored : null;
  const previewEligible = useMemo(
    () => eligibleHirelings(ownedHirelingIds, finalFactionIds).length,
    [ownedHirelingIds, finalFactionIds],
  );

  const draw = () => {
    const result = drawHirelings(ownedHirelingIds, finalFactionIds, playerCount);
    setStored({
      fingerprint,
      eligibleCount: result.eligibleCount,
      picks: result.picks.map((p) => ({ id: p.hireling.id, demoted: p.demoted })),
    });
  };

  const summaryItems: SummaryItem[] = (valid?.picks ?? []).map((p) => {
    const h = byHirelingId[p.id];
    return {
      primary: p.demoted ? `${h.demoted} (Demoted)` : h.promoted,
      sub: p.demoted ? `demoted side — promoted side is ${h.promoted}` : `flip to “${h.demoted}” if this one demotes`,
    };
  });

  return (
    <>
      <h2>Hirelings (optional)</h2>
      <Explainer id="exp-hirelings" summary="How this works">
        Deals 3 hirelings from your owned packs (Law A.6), skipping any whose corresponding faction is already at
        the table (the Exile/Brigand skips if either Vagabond board or the Knaves are in play). {demoteNote(playerCount)}{" "}
        Starting with the last player in turn order and going counterclockwise, each player sets up one dealt
        hireling as described on its card, then place the three hireling markers on the “4”, “8”, and “12” spaces
        of the score track (A.6.3–A.6.4). Control isn’t assigned now — a player only gains a hireling once their
        score marker crosses its space (Appendix H).
      </Explainer>
      {valid ? (
        <>
          {valid.picks.length < 3 && (
            <p className="note">
              Only {valid.eligibleCount} eligible hireling{valid.eligibleCount === 1 ? "" : "s"} to deal from — own
              more packs in Settings for a full deal of three.
            </p>
          )}
          <SummaryList items={summaryItems} />
          <div className="btn-row">
            <button className="btn secondary" onClick={draw} disabled={previewEligible === 0}>
              Redraw
            </button>
            <button className="btn secondary" onClick={() => setStored(null)}>
              Remove hirelings
            </button>
          </div>
        </>
      ) : (
        <div className="btn-row">
          <button className="btn secondary" onClick={draw} disabled={previewEligible === 0}>
            Add Hirelings
          </button>
        </div>
      )}
      {previewEligible === 0 && (
        <p className="note">
          {ownedHirelingIds.size === 0
            ? "No hireling packs marked as owned — add them in Settings."
            : "Every owned hireling's corresponding faction is already at this table."}
        </p>
      )}
    </>
  );
}
