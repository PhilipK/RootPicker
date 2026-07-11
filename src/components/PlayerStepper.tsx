import { useAppContext } from "../context/AppContext";

export function PlayerStepper() {
  const { playerCount, setPlayerCount } = useAppContext();
  return (
    <div className="stepper" aria-label="Player count">
      <button aria-label="Fewer players" disabled={playerCount <= 2} onClick={() => setPlayerCount(playerCount - 1)}>
        −
      </button>
      <span className="count">{playerCount}</span>
      <button aria-label="More players" disabled={playerCount >= 6} onClick={() => setPlayerCount(playerCount + 1)}>
        +
      </button>
    </div>
  );
}
