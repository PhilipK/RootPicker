import type { Hireling } from "../data/hirelings";
import { hirelingImageSrc } from "../data/hirelings";

/** The real card art (public/assets/hirelings), promoted or demoted side. */
export function HirelingThumb({ hireling, demoted, small }: { hireling: Hireling; demoted?: boolean; small?: boolean }) {
  const cls = `hireling-thumb${small ? " small" : ""}`;
  return <img className={cls} src={hirelingImageSrc(hireling, !!demoted)} alt="" />;
}
