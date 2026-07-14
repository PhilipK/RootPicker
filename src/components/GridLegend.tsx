/** Tiny, unobtrusive key for the two badges that otherwise only explain
    themselves through a `title` tooltip — invisible on touch devices.
    Drop it right under a grid's header/explainer, above the `.grid` itself. */
export function GridLegend({ corner = false }: { corner?: boolean }) {
  return (
    <p className="grid-legend">
      <span className="grid-legend-badge" aria-hidden="true">
        10
      </span>{" "}
      reach — higher carries more of the table total
      {corner && (
        <>
          {" "}
          <span className="grid-legend-sep" aria-hidden="true">
            ·
          </span>{" "}
          <span className="grid-legend-corner" aria-hidden="true">
            corner
          </span>{" "}
          — starts in a corner clearing
        </>
      )}
    </p>
  );
}
