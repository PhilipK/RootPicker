/** Surfaces why a disabled faction card can't be picked right now. Disabled
    buttons swallow clicks, so cards report their reason via a wrapper tap
    (see FactionCard's `onDisabledTap`) into this dismissable, aria-live note
    instead of relying on a `title` tooltip that touch users never see. */
export function DisabledReasonNote({ reason, onDismiss }: { reason: string | null; onDismiss: () => void }) {
  if (!reason) return null;
  return (
    <p className="disabled-note" role="status" aria-live="polite">
      <span>{reason}</span>
      <button type="button" className="disabled-note-dismiss" aria-label="Dismiss" onClick={onDismiss}>
        ×
      </button>
    </p>
  );
}
