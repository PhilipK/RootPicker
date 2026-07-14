import { PlayerCountBar } from "./PlayerCountBar";

export function Header() {
  return (
    <header>
      <h1>Root · Faction Picker</h1>
      <div className="rule">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 2c4 2 7 6 7 10.5C19 18 15.5 21 12 22c-3.5-1-7-4-7-9.5C5 8 8 4 12 2z" />
          <path d="M12 4v16" stroke="var(--paper)" strokeWidth=".6" fill="none" />
        </svg>
      </div>
      <p>per the Law of Root, October 2025</p>
      <PlayerCountBar />
    </header>
  );
}
