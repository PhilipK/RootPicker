export function SetupChecklist({ variant }: { variant: "advanced" | "standard" }) {
  if (variant === "advanced") {
    return (
      <ul className="checklist">
        <li>
          Each player draws <b>five</b> cards{" "}
          <span className="law-ref">(A.7 — two players: remove the four dominance cards first)</span>
        </li>
        <li>
          Place score markers on “0” <span className="law-ref">(A.9)</span>
        </li>
        <li>
          Everyone keeps <b>three</b> cards and puts two face down on the deck, then shuffle it{" "}
          <span className="law-ref">(A.10)</span>
        </li>
      </ul>
    );
  }
  return (
    <ul className="checklist">
      <li>
        Standard setup: each player draws <b>three</b> cards{" "}
        <span className="law-ref">(two players: remove the four dominance cards first)</span>
      </li>
      <li>
        Using the Advanced Setup board steps instead? Draw <b>five</b>, and after setup keep three{" "}
        <span className="law-ref">(A.7, A.10)</span>
      </li>
    </ul>
  );
}
