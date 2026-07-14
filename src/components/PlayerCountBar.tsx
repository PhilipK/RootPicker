import { useAppContext } from "../context/AppContext";

export function PlayerCountBar() {
  const { playerCount, setPlayerCount } = useAppContext();
  return (
    <div className="player-bar" aria-label="Player count">
      <button aria-label="Fewer players" disabled={playerCount <= 2} onClick={() => setPlayerCount(playerCount - 1)}>
        −
      </button>
      <span className="player-bar-count">
        <span className="n">{playerCount}</span> Players
      </span>
      <button aria-label="More players" disabled={playerCount >= 6} onClick={() => setPlayerCount(playerCount + 1)}>
        +
      </button>
    </div>
  );
}
