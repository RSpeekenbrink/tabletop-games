/**
 * DiceBear "glyphs" avatar (https://www.dicebear.com/styles/glyphs/).
 *
 * The seed is the username — DiceBear hashes it into a deterministic glyph,
 * so the same name renders the same face across every session, every device,
 * and every game. Names that match cosmetically collide on purpose (it's a
 * feature: "Alice" always looks like Alice).
 */
const DICEBEAR_URL = "https://api.dicebear.com/10.x/glyphs/svg";

interface Props {
  seed: string;
  size?: number;
  className?: string;
}

export function Avatar({ seed, size = 32, className }: Props) {
  const src = `${DICEBEAR_URL}?seed=${encodeURIComponent(seed)}`;
  return (
    <img
      className={`avatar ${className ?? ""}`.trim()}
      src={src}
      width={size}
      height={size}
      alt=""
      aria-hidden="true"
      draggable={false}
      loading="lazy"
    />
  );
}
