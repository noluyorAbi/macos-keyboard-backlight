/**
 * Real ANSI output, turned into spans.
 *
 * The point of this module: you capture a command's stdout with colour intact
 * (`script -q /dev/null your-cmd`, or just redirect a tool that keeps colour
 * when piped), paste it into `content.ts`, and the video shows exactly what the
 * terminal showed. Nothing gets retyped by hand, so nothing drifts from the
 * real tool.
 *
 * What is understood:
 *   - SGR colour codes: 30-37, 90-97, 39 (reset fg), 38;5;N (xterm-256),
 *     38;2;R;G;B (truecolor), 0 (reset all), 1 (bold), 2 (faint), 22 (normal).
 *   - Background codes (40-49, 48;...) are parsed and then ignored: a coloured
 *     block behind the text fights the window chrome, and captured CLI output
 *     almost never depends on it.
 *   - Every other CSI sequence (cursor moves, erase-line, and so on) is
 *     consumed and dropped, as are OSC sequences (window titles, hyperlinks).
 *   - `\r` clears the current line, which is how a progress bar redrawing in
 *     place collapses to just its final state.
 *   - `\t` expands to the next 8-column tab stop.
 *
 * The 16 basic colours are mapped to a curated dark-terminal palette rather
 * than the raw xterm defaults. Raw xterm blue is #0000ee, which is close to
 * unreadable on a near-black surface, and raw red is pure #ff0000, which drags
 * the eye off the content. The curated set sits in the same family as the rest
 * of the frame. The 256-colour cube and greyscale ramp use the real xterm
 * formula, so `38;5;253` and friends come out byte-exact.
 */

import { mix } from "./color";
import type { TermLine } from "./content-types";
import type { Span } from "./spans";

/** Curated stand-ins for the 16 basic ANSI colours on a near-black surface. */
export const ANSI16: readonly string[] = [
  "#3a3a37", // 0 black, lifted so it is visible at all
  "#d9756b", // 1 red
  "#87d787", // 2 green
  "#d7af5f", // 3 yellow
  "#5fafd7", // 4 blue
  "#c78bd9", // 5 magenta
  "#5fd7c7", // 6 cyan
  "#dadada", // 7 white
  "#6c6c6c", // 8 bright black
  "#f0938a", // 9 bright red
  "#a6e3a1", // 10 bright green
  "#e5c07b", // 11 bright yellow
  "#82c8ea", // 12 bright blue
  "#d9a3e8", // 13 bright magenta
  "#8ce8db", // 14 bright cyan
  "#faf9f5", // 15 bright white
];

/** The colour text falls back to when no SGR colour is active. */
export const TERM_FG = "#dadada";
/** The surface the text sits on, used to compute the faint (SGR 2) colour. */
const TERM_BG = "#0b0b0b";

const CUBE = [0, 95, 135, 175, 215, 255];

/** xterm-256 index to hex, the real formula. */
export const xterm256 = (n: number): string => {
  if (n < 16) {
    return ANSI16[n];
  }
  if (n < 232) {
    const i = n - 16;
    const r = CUBE[Math.floor(i / 36)];
    const g = CUBE[Math.floor((i % 36) / 6)];
    const b = CUBE[i % 6];
    const hex = (v: number): string => (v < 16 ? "0" : "") + v.toString(16);
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }
  const v = 8 + (n - 232) * 10;
  const hex = (v < 16 ? "0" : "") + v.toString(16);
  return `#${hex}${hex}${hex}`;
};

const ESC = "\u001b";
const BEL = "\u0007";

type Style = { color?: string; bold: boolean; faint: boolean };

const RESET: Style = { color: undefined, bold: false, faint: false };

/** The colour a span actually gets drawn in, faintness folded in. */
const resolve = (style: Style): string | undefined => {
  if (!style.faint) {
    return style.color;
  }
  return mix(style.color ?? TERM_FG, TERM_BG, 0.45);
};

const applySgr = (params: number[], style: Style): Style => {
  let next: Style = { ...style };
  for (let i = 0; i < params.length; i++) {
    const p = params[i];
    if (p === 0) {
      next = { ...RESET };
    } else if (p === 1) {
      next.bold = true;
    } else if (p === 2) {
      next.faint = true;
    } else if (p === 22) {
      next.bold = false;
      next.faint = false;
    } else if (p >= 30 && p <= 37) {
      next.color = ANSI16[p - 30];
    } else if (p === 39) {
      next.color = undefined;
    } else if (p >= 90 && p <= 97) {
      next.color = ANSI16[p - 90 + 8];
    } else if (p === 38 || p === 48) {
      // extended colour: 5;N (256) or 2;R;G;B (truecolor)
      const mode = params[i + 1];
      if (mode === 5) {
        const idx = params[i + 2] ?? 0;
        if (p === 38) {
          next.color = xterm256(idx);
        }
        i += 2;
      } else if (mode === 2) {
        const r = params[i + 2] ?? 0;
        const g = params[i + 3] ?? 0;
        const b = params[i + 4] ?? 0;
        if (p === 38) {
          const hex = (v: number): string =>
            (v < 16 ? "0" : "") + Math.max(0, Math.min(255, v)).toString(16);
          next.color = `#${hex(r)}${hex(g)}${hex(b)}`;
        }
        i += 4;
      }
    }
    // everything else (backgrounds, italics, underlines, blink) is ignored
  }
  return next;
};

/** Glyphs no monospace webfont ships, drawn as SVG instead of text. */
const ICONS: { [ch: string]: Span["icon"] } = { "⎇": "branch" };

/** Split a run so that icon glyphs become their own spans. */
const pushRun = (out: Span[], text: string, style: Style): void => {
  if (text.length === 0) {
    return;
  }
  const color = resolve(style);
  let buf = "";
  for (const ch of text) {
    const icon = ICONS[ch];
    if (icon) {
      if (buf) {
        out.push({ text: buf, color, bold: style.bold });
        buf = "";
      }
      out.push({ text: ch, color, bold: style.bold, icon });
    } else {
      buf += ch;
    }
  }
  if (buf) {
    out.push({ text: buf, color, bold: style.bold });
  }
};

/** Drop trailing whitespace, which captured output is full of. */
const trimTrailing = (spans: Span[]): Span[] => {
  const out = spans.slice();
  while (out.length > 0) {
    const last = out[out.length - 1];
    const trimmed = last.text.replace(/\s+$/, "");
    if (trimmed.length === 0) {
      out.pop();
    } else {
      out[out.length - 1] = { ...last, text: trimmed };
      break;
    }
  }
  return out;
};

/**
 * Parse raw captured output into one `TermLine` per line.
 *
 * Trailing blank lines are dropped; interior blank lines are kept, because the
 * vertical rhythm of the original output is part of how it reads.
 */
export const fromAnsi = (raw: string): TermLine[] => {
  const lines: Span[][] = [];
  let current: Span[] = [];
  let run = "";
  let style: Style = { ...RESET };
  let col = 0;

  const flushRun = (): void => {
    pushRun(current, run, style);
    run = "";
  };
  const endLine = (): void => {
    flushRun();
    lines.push(trimTrailing(current));
    current = [];
    col = 0;
  };

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (ch === ESC) {
      const next = raw[i + 1];
      if (next === "[") {
        // CSI: parameters, then a final byte in 0x40..0x7e
        let j = i + 2;
        let params = "";
        while (j < raw.length) {
          const c = raw[j];
          const code = c.charCodeAt(0);
          if (code >= 0x40 && code <= 0x7e) {
            break;
          }
          params += c;
          j++;
        }
        const final = raw[j];
        if (final === "m") {
          flushRun();
          const nums = params
            .replace(/:/g, ";")
            .split(";")
            .map((p) => (p === "" ? 0 : Number.parseInt(p, 10)))
            .filter((n) => Number.isFinite(n));
          style = applySgr(nums.length === 0 ? [0] : nums, style);
        }
        i = j;
        continue;
      }
      if (next === "]") {
        // OSC: runs until BEL or ST (ESC backslash)
        let j = i + 2;
        while (j < raw.length) {
          if (raw[j] === BEL) {
            break;
          }
          if (raw[j] === ESC && raw[j + 1] === "\\") {
            j++;
            break;
          }
          j++;
        }
        i = j;
        continue;
      }
      // any other two-character escape
      i += 1;
      continue;
    }

    if (ch === "\n") {
      endLine();
      continue;
    }
    if (ch === "\r") {
      // the line is being redrawn in place: keep only what comes after
      run = "";
      current = [];
      col = 0;
      continue;
    }
    if (ch === "\t") {
      const width = 8 - (col % 8);
      run += " ".repeat(width);
      col += width;
      continue;
    }
    if (ch < " " && ch !== " ") {
      continue; // any other control character
    }

    run += ch;
    col += 1;
  }

  endLine();

  while (lines.length > 0 && lines[lines.length - 1].length === 0) {
    lines.pop();
  }

  return lines.map((spans) => ({ spans }));
};

/** Strip every escape sequence, for measuring or debugging. */
export const stripAnsi = (raw: string): string =>
  fromAnsi(raw)
    .map((l) => l.spans.map((s) => s.text).join(""))
    .join("\n");
