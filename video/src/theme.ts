/**
 * Palette, motion tokens and layout metrics.
 *
 * Nothing in this file is per-project except the accent, which is read out of
 * `content.ts`. Do not edit the palette or the easing curves: they are what
 * makes every project rendered from this template look like one family.
 *
 * Two colour sources, deliberately kept apart:
 *
 * 1. `claude`: the surface and chrome tokens. This project overrides the
 *    template's Anthropic palette with the landing page's own Apple greys
 *    (measured off apple.com: pure black stage, #1d1d1f surfaces, #f5f5f7
 *    copy), so the clip, the banner and the page read as one piece of work.
 *    The token names stay `claude.*` because every scene imports them.
 * 2. `ansi`: true xterm-256 colours. These style the *output text*, so
 *    captured output in the video is the same output you get in a real
 *    256-colour terminal.
 *
 * The accent is reserved. It is spent on the prompt caret, the cursor, the
 * brand mark, the `$` in the install line, and the background wash. If
 * everything is accented, nothing is.
 */

import { xterm256 } from "./ansi";
import { mix } from "./color";
import { content } from "./content";
import { spanLen } from "./spans";

/** The house colour: the Claude coral. `content.accent` overrides it. */
export const DEFAULT_ACCENT = "#d97757";

export const accent = content.accent ?? DEFAULT_ACCENT;

export const claude = {
  clay: accent, // the accent itself
  clayDeep: mix(accent, "#000000", 0.16), // pressed / emphasised variant
  bg: "#161617", // terminal backdrop, a shade above the black stage
  frame: "#000000", // page behind the window: Apple's black stage
  panel: "#1d1d1f", // window chrome, the landing's --surface
  panelHi: "#262629", // the landing's --surface-high
  border: "#333336", // hairline, one step up from --hairline for 1px at 1080p
  dim: "#a1a1a6", // the landing's --dim-text
  text: "#f5f5f7", // the landing's --text
  bright: "#ffffff", // headline
} as const;

/**
 * The xterm-256 indices a well-behaved CLI uses for its own chrome, resolved
 * through the same table `ansi.ts` uses for captured output. Kept as named
 * roles so the stills can speak the same colour language as the terminal.
 */
export const ansi = {
  fg: xterm256(253), // primary
  sec: xterm256(248), // secondary
  mut: xterm256(242), // muted
  fnt: xterm256(238), // faint
  info: xterm256(74), // ids, links, sparklines
  ok: xterm256(114), // success, "today"
  warn: xterm256(179), // caution, "yesterday"
} as const;

/** Anthropic's own easing curves, straight from the Claude Code design tokens. */
export const easing = {
  out: [0.165, 0.84, 0.44, 1] as [number, number, number, number], // --ease-out
  snap: [0.32, 0.72, 0, 1] as [number, number, number, number], // --ease-snap
} as const;

/** Every composition and every timing constant in this project assumes 30fps. */
export const FPS = 30;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export const FRAME_W = 1920;
export const FRAME_H = 1080;

export const PAD_X = 40;
export const PAD_Y = 28;
export const TITLEBAR_H = 48;

/** The widest the window may get, leaving a comfortable margin in a 1920 frame. */
const MAX_CONTENT_W = 1680;

const clamp = (n: number, lo: number, hi: number): number =>
  Math.max(lo, Math.min(hi, n));

const demo = content.demo;
const termLines = demo.kind === "terminal" ? demo.lines : [];

/** Widest captured line, in columns. The typed command counts too. */
const widestLine = (): number => {
  let w = demo.kind === "terminal" ? demo.command.length + 2 : 0;
  for (const line of termLines) {
    if (!line.wrap) {
      w = Math.max(w, spanLen(line.spans));
    }
  }
  return w;
};

/** Rows the finished buffer occupies: the prompt, a blank, then the output. */
const bufferRows = (): number => {
  let rows = 2;
  for (const line of termLines) {
    rows += line.rows ?? 1;
  }
  return rows;
};

/**
 * Terminal metrics, derived from the captured output rather than hardcoded.
 *
 * JetBrains Mono has an advance width of exactly 600/1000 em for every glyph it
 * ships (verified against the font's hmtx table, including the box-drawing and
 * block characters), so one column is exactly 0.6 * fontSize. That is what lets
 * the column count decide the type size instead of the other way round.
 *
 * Type is sized to the widest line so nothing hard-wraps: a wrapped line reads
 * as a bug in the tool being demoed, not as a rendering artefact. 25px is the
 * ceiling (large enough to read in a GIF at 50% scale) and 13px the floor.
 */
const cols = clamp(widestLine() + 2, 72, 132);
const fontSize = clamp(Math.floor(MAX_CONTENT_W / (cols * 0.6)), 13, 25);

export const TERM = {
  cols,
  fontSize,
  charW: fontSize * 0.6,
  lineHeight: Math.round(fontSize * 1.36), // in the range real terminals use
  /**
   * The window is exactly as tall as the finished buffer, up to 24 rows. Output
   * longer than that scrolls, the way a real terminal scrolls, instead of
   * shrinking the type until it cannot be read.
   */
  viewportRows: clamp(bufferRows(), 8, 24),
} as const;

export const CONTENT_W = TERM.cols * TERM.charW;
export const VIEWPORT_H = TERM.viewportRows * TERM.lineHeight;

/** Terminal window box. */
export const WINDOW_W = Math.round(CONTENT_W + PAD_X * 2);
export const WINDOW_H = VIEWPORT_H + TITLEBAR_H + PAD_Y * 2;

/** Screenshot window box: a 16:9 stage in the same chrome. */
export const SHOT_W = 1520;
export const SHOT_H = 855; // 16:9
export const SHOT_WINDOW_W = SHOT_W;
export const SHOT_WINDOW_H = SHOT_H + TITLEBAR_H;
