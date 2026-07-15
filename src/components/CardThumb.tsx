/** A small settings-chip thumbnail for any bundled card image. */
export function CardThumb({ src }: { src: string }) {
  return <img className="pack-chip-thumb" src={src} alt="" />;
}
