/**
 * Tiny colour helpers.
 *
 * This module imports nothing on purpose: both `theme.ts` and `ansi.ts` use it,
 * and `theme.ts` reads the accent out of `content.ts`, so anything imported
 * here would risk an import cycle.
 */

const clamp255 = (n: number): number => Math.max(0, Math.min(255, Math.round(n)));

/** "#rgb" or "#rrggbb" to [r, g, b]. Anything unparseable falls back to black. */
export const toRgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "").trim();
  const full =
    h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h.slice(0, 6);
  const n = Number.parseInt(full, 16);
  if (!Number.isFinite(n) || full.length !== 6) {
    return [0, 0, 0];
  }
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export const toHex = (r: number, g: number, b: number): string => {
  const part = (v: number): string => {
    const s = clamp255(v).toString(16);
    return s.length === 1 ? "0" + s : s;
  };
  return `#${part(r)}${part(g)}${part(b)}`;
};

/** Linear blend: t = 0 returns `a`, t = 1 returns `b`. */
export const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = toRgb(a);
  const [br, bg, bb] = toRgb(b);
  return toHex(ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t);
};

/** `rgba()` string from a hex colour plus an alpha, for gradients and shadows. */
export const withAlpha = (hex: string, alpha: number): string => {
  const [r, g, b] = toRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};
