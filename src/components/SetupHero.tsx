import { FACTIONS, imgSrc } from "../data/factions";

// A handful of visually distinct factions — purely decorative, not a
// recommendation — to keep the pre-deal setup screens from being just a
// form floating in a void.
const HERO_IDS = ["marquise", "eyrie", "vagabond", "riverfolk", "lizard", "woodland"];
const HERO_FACTIONS = HERO_IDS.map((id) => FACTIONS.find((f) => f.id === id)).filter(
  (f): f is (typeof FACTIONS)[number] => !!f,
);

export function SetupHero() {
  return (
    <div className="setup-hero" aria-hidden="true">
      {HERO_FACTIONS.map((f) => (
        <img key={f.id} src={imgSrc(f)} alt="" />
      ))}
    </div>
  );
}
