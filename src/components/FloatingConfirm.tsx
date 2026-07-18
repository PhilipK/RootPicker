import type { ReactNode } from "react";

/**
 * Floating action bar pinned just above the bottom of the viewport, so the
 * confirm for a tall faction grid never hides below the fold. While the pick
 * is incomplete it shows `hint` as a muted status pill (or nothing, if no
 * hint is given); the moment `ready` flips, the real button(s) animate in on
 * screen right where the player's thumb already is.
 */
export function FloatingConfirm({ ready, hint, children }: { ready: boolean; hint?: ReactNode; children: ReactNode }) {
  if (!ready && !hint) return null;
  return (
    <div className="floating-confirm" aria-live="polite">
      {ready ? (
        <div className="floating-confirm-actions">{children}</div>
      ) : (
        <p className="floating-confirm-hint">{hint}</p>
      )}
    </div>
  );
}
