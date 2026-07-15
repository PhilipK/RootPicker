import { drawKnaveCaptains } from "../lib/knaveCaptainDraw";
import { useKnaveCaptainDraw } from "../lib/store";
import { byKnaveCaptainId, knaveCaptainCardSearchUrl, knaveCaptainImageSrc } from "../data/knaveCaptains";
import { Explainer } from "./Explainer";

/** Deals 4 random Knave Captain cards when the Knaves are in the final
    lineup (Law A.8.2.IV); tapping one marks it as the card left out, so the
    other 3 are the ones kept for setup (18.3.2). Renders nothing otherwise. */
export function KnaveCaptainSetup({ storageKey, finalFactionIds }: { storageKey: string; finalFactionIds: Set<string> }) {
  const present = finalFactionIds.has("knaves");
  const fingerprint = String(present);
  const [stored, setStored] = useKnaveCaptainDraw(storageKey);
  const valid = stored && stored.fingerprint === fingerprint ? stored : null;

  if (!present) return null;

  const draw = () => {
    const dealt = drawKnaveCaptains();
    setStored({ fingerprint, dealtIds: dealt.map((c) => c.id), excludedId: null });
  };

  const toggleExclude = (id: string) => {
    if (!valid) return;
    setStored({ ...valid, excludedId: valid.excludedId === id ? null : id });
  };

  return (
    <>
      <h2>Knave Captains (optional)</h2>
      <Explainer id="exp-knave-captains" summary="How this works">
        Deals 4 random Captain cards; the Knaves choose 3 to keep in their own faction setup (Law A.8.2.IV, 18.3.2).
        Tap the one to leave out.
      </Explainer>
      {valid ? (
        <>
          <ul className="captain-reveal">
            {valid.dealtIds.map((id) => {
              const c = byKnaveCaptainId[id];
              const excluded = valid.excludedId === id;
              return (
                <li key={id} className={excluded ? "excluded" : undefined}>
                  <button className="card-tap" aria-pressed={excluded} onClick={() => toggleExclude(id)}>
                    <img src={knaveCaptainImageSrc(c)} alt={c.name} />
                    {excluded && <span className="demoted-badge">Left out</span>}
                  </button>
                  <a className="view-card-link law-ref" href={knaveCaptainCardSearchUrl(c.name)} target="_blank" rel="noreferrer">
                    view card ↗
                  </a>
                </li>
              );
            })}
          </ul>
          <p className="note">
            {valid.excludedId
              ? `Keeping ${valid.dealtIds
                  .filter((id) => id !== valid.excludedId)
                  .map((id) => byKnaveCaptainId[id].name)
                  .join(", ")}.`
              : "Tap the captain to leave out."}
          </p>
          <div className="btn-row">
            <button className="btn secondary" onClick={draw}>
              Redraw
            </button>
            <button className="btn secondary" onClick={() => setStored(null)}>
              Remove
            </button>
          </div>
        </>
      ) : (
        <div className="btn-row">
          <button className="btn secondary" onClick={draw}>
            Deal Captains
          </button>
        </div>
      )}
    </>
  );
}
