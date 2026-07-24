/**
 * The span model for coloured terminal text.
 *
 * A terminal line is an array of spans: a run of characters plus the colour and
 * weight it is drawn with. The same array works for both the typed reveal
 * (slice it) and the instant output path (render it whole), and it is trivially
 * serialisable, so real captured stdout can be turned into it once (see
 * `ansi.ts`) and then never re-parsed at render time.
 *
 * You normally do not build these by hand. `fromAnsi()` in `ansi.ts` produces
 * them from raw captured output. Hand-authoring is only for the rare line you
 * want to invent (a fake prompt, a highlight).
 */

export type Span = {
  text: string;
  /** CSS colour. Omitted means "inherit the terminal foreground". */
  color?: string;
  bold?: boolean;
  /**
   * Render an SVG glyph instead of `text`, occupying `text.length` columns.
   * Needed for glyphs no monospace font ships: U+2387 (the branch mark) is
   * missing even from the full JetBrains Mono, so it would render as a tofu
   * box. `text` is still used for column accounting.
   */
  icon?: "branch";
};

export const spanLen = (spans: Span[]): number => {
  let n = 0;
  for (const s of spans) {
    n += s.text.length;
  }
  return n;
};

/** Slice a span array to the first `count` characters, preserving colours. */
export const sliceSpans = (spans: Span[], count: number): Span[] => {
  const out: Span[] = [];
  let remaining = count;
  for (const s of spans) {
    if (remaining <= 0) {
      break;
    }
    out.push({ ...s, text: s.text.slice(0, remaining) });
    remaining -= s.text.length;
  }
  return out;
};

/** Left-pad to width n, without relying on String.padStart. */
export const padLeft = (s: string, n: number): string => {
  let out = s;
  while (out.length < n) {
    out = " " + out;
  }
  return out;
};

export const spaces = (n: number): string => (n > 0 ? " ".repeat(n) : "");
