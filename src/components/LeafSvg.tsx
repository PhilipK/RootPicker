/** A single autumn leaf in the app's ink-drawn style, colored by `currentColor`.
    Shared by the reveal ceremony's falling leaves and the reach stamp's burst. */
export function LeafSvg() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M20.5 3.5c-7.4-.5-12.9 1.9-15.4 6-1.9 3.1-1.7 6.9.2 9.4l-1.8 1.8 1.3 1.3 1.8-1.8c2.5 1.9 6.3 2.1 9.4.2 4.1-2.5 6.5-8 6-15.4z"
      />
      <path fill="none" stroke="rgba(35,44,26,.55)" strokeWidth="1.3" d="M6.5 17.5C9.5 13 13.5 9 18 6.5" />
    </svg>
  );
}

/* Autumn palette off the app's own faction colors. */
export const LEAF_COLORS = ["#B08D2E", "#8C2B1E", "#5F7036", "#A6612B", "#6B5B40"];
