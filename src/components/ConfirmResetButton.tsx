import { useEffect, useState, type ReactNode } from "react";

export const ARM_TIMEOUT_MS = 4000;

/** A "Start over" / "New game" button that requires two taps.
    The device gets passed around a table all game night — one accidental
    tap shouldn't wipe everyone's seating and picks. */
export function ConfirmResetButton({
  onConfirm,
  children,
  className = "btn secondary",
}: {
  onConfirm: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), ARM_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <button
      type="button"
      className={className + (armed ? " armed" : "")}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
    >
      {armed ? "Tap again to confirm" : children}
    </button>
  );
}
