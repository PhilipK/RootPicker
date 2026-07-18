import { useMemo } from "react";
import { useAppContext } from "../context/AppContext";
import { drawVagabondCharacters, eligibleVagabondCharacters } from "../lib/vagabondDraw";
import { useVagabondCharacterDraw } from "../lib/store";
import { byVagabondCharacterId, vagabondCharacterCardSearchUrl, vagabondCharacterImageSrc } from "../data/vagabondCharacters";
import { Explainer } from "./Explainer";

function fingerprintOf(slots: string[], ownedIds: Set<string>): string {
  return JSON.stringify([slots, [...ownedIds].sort()]);
}

/** Deals a random Vagabond character card per Vagabond board in the final
    lineup (Law A.8.2.III) — 1 card for Vagabond alone, 2 distinct cards if
    the Second Vagabond is also in play. Renders nothing if neither is. */
export function VagabondCharacterSetup({ storageKey, finalFactionIds }: { storageKey: string; finalFactionIds: Set<string> }) {
  const { ownedVagabondCharacterIds } = useAppContext();
  const [stored, setStored] = useVagabondCharacterDraw(storageKey);

  const slots = useMemo(() => {
    const s: string[] = [];
    if (finalFactionIds.has("vagabond")) s.push("vagabond");
    if (finalFactionIds.has("vagabond2")) s.push("vagabond2");
    return s;
  }, [finalFactionIds]);

  const fingerprint = useMemo(() => fingerprintOf(slots, ownedVagabondCharacterIds), [slots, ownedVagabondCharacterIds]);
  const valid = stored && stored.fingerprint === fingerprint ? stored : null;
  const eligibleCount = useMemo(
    () => eligibleVagabondCharacters(ownedVagabondCharacterIds).length,
    [ownedVagabondCharacterIds],
  );

  if (slots.length === 0) return null;

  const draw = () => {
    const drawn = drawVagabondCharacters(ownedVagabondCharacterIds, slots.length);
    setStored({ fingerprint, characterIds: drawn.map((c) => c.id) });
  };

  const short = eligibleCount < slots.length;

  return (
    <>
      <h2>Vagabond Character{slots.length > 1 ? "s" : ""} (optional)</h2>
      <Explainer id="exp-vagabond-characters" summary="How this works">
        Deals {slots.length > 1 ? "2 different random character cards, one per Vagabond board" : "a random character card"}{" "}
        (Law A.8.2.III).
      </Explainer>
      {valid ? (
        <>
          {short && (
            <p className="note">
              Only {eligibleCount} owned character{eligibleCount === 1 ? "" : "s"} — add more in Settings for a full
              deal.
            </p>
          )}
          <ul className="character-reveal" key={valid.characterIds.join("|")}>
            {valid.characterIds.map((id, i) => {
              const c = byVagabondCharacterId[id];
              return (
                <li key={id}>
                  <a href={vagabondCharacterCardSearchUrl(c.name)} target="_blank" rel="noreferrer">
                    <img src={vagabondCharacterImageSrc(c)} alt={c.name} />
                  </a>
                  {slots.length > 1 && <p className="note" style={{ textAlign: "center", margin: "4px 0" }}>{i === 0 ? "Vagabond" : "Second Vagabond"}</p>}
                </li>
              );
            })}
          </ul>
          <div className="btn-row">
            <button className="btn secondary" onClick={draw} disabled={eligibleCount === 0}>
              Redraw
            </button>
            <button className="btn secondary" onClick={() => setStored(null)}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <div className="btn-row">
          <button className="btn secondary" onClick={draw} disabled={eligibleCount === 0}>
            Deal Character{slots.length > 1 ? "s" : ""}
          </button>
        </div>
      )}
      {eligibleCount === 0 && (
        <p className="note">No Vagabond characters marked as owned — add them in Settings.</p>
      )}
    </>
  );
}
