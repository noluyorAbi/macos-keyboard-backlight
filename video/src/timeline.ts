/**
 * Every timing in the video, derived from `content.ts`.
 *
 * Nothing here is hand-tuned per project: feed it two lines of output or forty,
 * three screenshots or six, and the beats still land. That is the whole point of
 * the template. All frame numbers are at 30fps.
 *
 * The motion brief this file implements:
 *
 *   - Scenes cross dissolve against a background that never moves. No hard cuts,
 *     nothing slides across the frame.
 *   - Typing is linear, never eased. Eased typing accelerates into the middle of
 *     a word and reads as a scripted animation; a human types at a steady rate.
 *   - The payoff (the finished output, the last screenshot) holds still, long
 *     enough to actually be read. Holding is the animation.
 *   - The last frame returns to the same empty background as the first frame,
 *     so the GIF loops without a visible seam.
 */

import { content } from "./content";
import type { ScreensDemo, TerminalDemo } from "./content-types";
import type { Span } from "./spans";
import { ansi, claude, FPS } from "./theme";

/** Characters per second at the prompt. Fast enough to not be boring. */
export const CPS = 18;

/** Entrance of a single output row: 8 frames, 267ms. */
export const LINE_IN = 8;

/** How long the finished state holds before the end card takes over. */
const HOLD = 90;

/** Default hold for one screenshot, if the shot does not say otherwise. */
export const DEFAULT_SHOT_HOLD = 90;

/** Cross dissolve between two screenshots. */
export const SHOT_FADE = 14;

// ---------------------------------------------------------------------------
// Scene-local: cold open
// ---------------------------------------------------------------------------

export const COLD_OPEN_DUR = 132;

/**
 * The opening title cards. `content.coldOpen` wins; otherwise the description
 * carries the setup and the tagline carries the payoff.
 */
export const COLD_OPEN_LINES: string[] = (() => {
  const given = content.coldOpen;
  if (given && given.length > 0) {
    return given.slice(0, 3);
  }
  return [content.description, content.tagline];
})();

// ---------------------------------------------------------------------------
// Scene-local: terminal
// ---------------------------------------------------------------------------

export type TLine = {
  key: string;
  /** scene-local frame at which the row appears */
  from: number;
  kind: "typed" | "out";
  spans: Span[];
  rows: number;
  wrap: boolean;
  /** typed rows only */
  typeAt?: number;
  submitAt?: number;
};

export type TerminalTimeline = {
  lines: TLine[];
  /** cumulative row offset of each line, for the scroll maths */
  rowOffsets: number[];
  totalRows: number;
  /** frame at which the window itself enters */
  windowIn: number;
  /** frame at which the scene has finished and starts leaving */
  duration: number;
};

const buildTerminal = (demo: TerminalDemo): TerminalTimeline => {
  const lines: TLine[] = [];
  const command = demo.command;
  const source = demo.lines;

  const promptAt = 8;
  const typeAt = 18;
  const typingFrames = Math.ceil((command.length / CPS) * FPS);
  const submitAt = typeAt + typingFrames + 8;

  lines.push({
    key: "prompt",
    from: promptAt,
    typeAt,
    submitAt,
    kind: "typed",
    rows: 1,
    wrap: false,
    spans: [
      { text: "> ", color: claude.clay, bold: true },
      { text: command, color: ansi.fg },
    ],
  });

  // one blank row between the command and its output, as a shell leaves
  const outputStart = submitAt + 6;
  lines.push({
    key: "gap",
    from: outputStart,
    kind: "out",
    spans: [],
    rows: 1,
    wrap: false,
  });

  /**
   * The build is paced to land in about four and a half seconds no matter how
   * many rows there are: long output arrives faster per row, short output gets
   * room to breathe. Below two frames the reveal stops reading as a build and
   * starts reading as a flicker.
   */
  const n = Math.max(1, source.length);
  const stagger = Math.max(2, Math.min(6, Math.floor(135 / n)));

  let cursor = outputStart + 4;
  source.forEach((line, i) => {
    lines.push({
      key: `l${i}`,
      from: cursor,
      kind: "out",
      spans: line.spans,
      rows: line.rows ?? 1,
      wrap: line.wrap ?? false,
    });
    const blank = line.spans.length === 0;
    cursor += (blank ? Math.max(1, stagger - 2) : stagger) + (line.pause ?? 0);
  });

  const rowOffsets: number[] = [];
  let row = 0;
  for (const l of lines) {
    rowOffsets.push(row);
    row += l.rows;
  }

  return {
    lines,
    rowOffsets,
    totalRows: row,
    windowIn: 0,
    duration: cursor + LINE_IN + HOLD,
  };
};

// ---------------------------------------------------------------------------
// Scene-local: screens
// ---------------------------------------------------------------------------

export type ShotBeat = {
  src: string;
  caption?: string;
  /** scene-local frame at which this shot starts fading in */
  from: number;
  /** frames until the next shot starts fading in (or the scene ends) */
  hold: number;
};

export type ScreensTimeline = {
  beats: ShotBeat[];
  windowIn: number;
  duration: number;
};

const buildScreens = (demo: ScreensDemo): ScreensTimeline => {
  const shots = demo.shots;
  const windowIn = 0;
  let cursor = 12; // the window is settled before the first shot arrives
  const beats: ShotBeat[] = shots.map((shot) => {
    const hold = shot.holdFrames ?? DEFAULT_SHOT_HOLD;
    const beat: ShotBeat = {
      src: shot.src,
      caption: shot.caption,
      from: cursor,
      hold,
    };
    cursor += hold;
    return beat;
  });

  return { beats, windowIn, duration: cursor + 12 };
};

// ---------------------------------------------------------------------------
// The composition
// ---------------------------------------------------------------------------

/**
 * Retained template surface, with no consumer in this project.
 *
 * `Demo.tsx` renders the keyboard scene unconditionally, so neither of these
 * selects the body any more and `BODY_DUR` below comes from `KB_DUR` instead.
 * They are still built here so the template's terminal and screenshot modes
 * stay restorable in one move, and so a malformed `content.demo` still fails
 * loudly rather than rotting unnoticed. See "This copy deviates from the
 * template" in README.md before deleting either.
 */
export const TERMINAL: TerminalTimeline | null =
  content.demo.kind === "terminal" ? buildTerminal(content.demo) : null;

export const SCREENS: ScreensTimeline | null =
  content.demo.kind === "screens" ? buildScreens(content.demo) : null;

// ---------------------------------------------------------------------------
// Scene-local: the keyboard payoff
// ---------------------------------------------------------------------------

/**
 * The command the shot actually runs. Two statements on purpose: turning the
 * sensor off first is the part every new user misses, so the demo teaches it
 * rather than showing a `kbdlight off` that would drift back up on its own.
 */
export const KB_COMMAND = "kbdlight auto off && kbdlight off";

/** Typing starts once the machine has settled, and runs at the house rate. */
export const KB_TYPE_AT = 22;
export const KB_TYPE_FRAMES = Math.ceil((KB_COMMAND.length / CPS) * FPS);

/**
 * A beat between the last keystroke and the light moving. Without it the two
 * read as one event and the causality is lost, which is the whole point of the
 * shot: the command did that.
 */
const KB_BEAT = 10;

export const KB_SWEEP_AT = KB_TYPE_AT + KB_TYPE_FRAMES + KB_BEAT;

/** How long one key takes to go dark: 11 frames, 367ms. */
export const KB_SWEEP_KEY_FRAMES = 11;

/** Frames between the first key starting and the last key starting. */
export const KB_SWEEP_SPREAD = 26;

/** The dark board holds, because holding is what makes the change land. */
const KB_HOLD = 46;

export const KB_DUR =
  KB_SWEEP_AT + KB_SWEEP_SPREAD + KB_SWEEP_KEY_FRAMES + KB_HOLD;

const BODY_DUR = KB_DUR;

/** The body starts while the cold open is still fading out. */
export const BODY_AT = 120;

/**
 * The end card holds still, then fades out completely over its last 18 frames.
 * Frame 0 of the video is the same empty background, so the GIF loops without a
 * seam. Do not remove the fade unless you also give the cold open something to
 * cut from.
 */
export const END_CARD_DUR = 168;
export const END_CARD_FADE_OUT = 18;

export const END_CARD_AT = BODY_AT + BODY_DUR - 12;
export const DEMO_DURATION = END_CARD_AT + END_CARD_DUR;

export const BODY_DURATION = BODY_DUR;

// ---------------------------------------------------------------------------
// Scene-local: the notification pulse
// ---------------------------------------------------------------------------

/**
 * The second demo: `kbdlight pulse`, the shot for the Claude Code hook.
 *
 * These frame counts are the real defaults of the shipped command, converted at
 * 30fps, not numbers chosen to look good in a video. If the defaults in
 * `src/pulse.js` change, change these with them, or the asset starts advertising
 * a rhythm the tool does not have.
 *
 *   preDarkMs 400 -> 12 frames
 *   onMs     1000 -> 30 frames
 *   offMs     500 -> 15 frames
 *   count        4
 */
export const PULSE_PREDARK = 12;
export const PULSE_ON = 30;
export const PULSE_OFF = 15;
export const PULSE_COUNT = 4;

/** Where the keyboard idles before and after: on, but nowhere near full. */
export const PULSE_AMBIENT = 0.32;

/** The response lands, and the status line flips. */
export const PULSE_DONE_AT = 36;

/**
 * A beat between the status flipping and the light moving. Without it the two
 * read as one event and the causality is lost, which is the whole shot: the
 * agent finished, so the keyboard told you.
 */
export const PULSE_BLINK_AT = PULSE_DONE_AT + 6;

/** Long enough to see the keyboard settle back to where it started. */
const PULSE_TAIL = 24;

export const PULSE_DURATION =
  PULSE_BLINK_AT +
  PULSE_PREDARK +
  PULSE_COUNT * (PULSE_ON + PULSE_OFF) +
  PULSE_TAIL;

/**
 * How lit the board is at this frame, 0 to 1.
 *
 * A square wave, on purpose and truthfully: measured through
 * `backlightLevelForKeyboard:`, the real LEDs reach full inside 26 ms, which is
 * less than one frame at 30fps. Drawing a fade here would be a nicer looking
 * lie. It is also uniform across every key, because the hardware is a single
 * zone: no wave, no per-key anything, which is exactly what the README says.
 */
export const pulseLight = (frame: number): number => {
  const t = frame - PULSE_BLINK_AT;
  if (t < 0) return PULSE_AMBIENT;
  if (t < PULSE_PREDARK) return 0;

  const cycle = PULSE_ON + PULSE_OFF;
  const into = t - PULSE_PREDARK;
  if (into >= PULSE_COUNT * cycle) return PULSE_AMBIENT; // restored, as the tool does
  return into % cycle < PULSE_ON ? 1 : 0;
};

/** Title bar label for the demo window. */
export const WINDOW_TITLE = content.windowTitle ?? content.name;
