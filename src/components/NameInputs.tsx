import { useAppContext } from "../context/AppContext";

export function NameInputs() {
  const { playerCount, names, setNames } = useAppContext();
  return (
    <div className="players-list">
      {Array.from({ length: playerCount }, (_, i) => (
        <label key={i}>
          <span className="seat">{i + 1}.</span>
          <input
            type="text"
            placeholder={`Player ${i + 1}`}
            value={names[i] || ""}
            onChange={(e) => {
              const next = names.slice();
              next[i] = e.target.value;
              setNames(next);
            }}
          />
        </label>
      ))}
    </div>
  );
}
