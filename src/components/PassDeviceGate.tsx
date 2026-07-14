import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Full-screen "pass the device" interstitial. Gates rendering of `children`
 * (the next actor's secret content) behind an explicit tap, so a phone
 * handed across the table never arrives already showing someone else's
 * secret picks.
 *
 * Acknowledgment is component-local state keyed to `actorKey`, not persisted:
 * whenever `actorKey` changes (a new secret turn) the gate reappears, and if
 * the device reloads mid-turn the local state is gone so the gate reappears
 * too — the safe default, since an extra tap costs nothing but a leaked
 * secret can't be undone.
 */
export function PassDeviceGate({
  actorName,
  actorKey,
  detail,
  footer,
  onAcknowledge,
  children,
}: {
  actorName: string;
  actorKey: string;
  /** Extra, non-secret context shown on the gate itself (e.g. a turn tracker). */
  detail?: ReactNode;
  /** Extra controls shown below the confirm button (e.g. a reset button). */
  footer?: ReactNode;
  /** Called once, the moment the player taps through — for advancing a
      reducer phase that's still one step behind the actual secret screen. */
  onAcknowledge?: () => void;
  children: ReactNode;
}) {
  const [ackKey, setAckKey] = useState<string | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const acknowledged = ackKey === actorKey;

  useEffect(() => {
    if (!acknowledged) btnRef.current?.focus();
  }, [acknowledged, actorKey]);

  if (acknowledged) return <>{children}</>;

  return (
    <div className="pass-gate" role="dialog" aria-modal="true" aria-label={`Pass the device to ${actorName}`}>
      <div className="pass-gate-card">
        <p className="pass-gate-label">Pass the device to</p>
        <p className="pass-gate-name">{actorName}</p>
        <p className="note">Only {actorName} should look at the next screen.</p>
        {detail}
        <button
          ref={btnRef}
          type="button"
          className="btn"
          onClick={() => {
            onAcknowledge?.();
            setAckKey(actorKey);
          }}
        >
          I’m {actorName} — show me
        </button>
        {footer && <div className="pass-gate-footer">{footer}</div>}
      </div>
    </div>
  );
}
