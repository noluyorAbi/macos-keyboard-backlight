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

export const TERMINAL: TerminalTimeline | null =
  content.demo.kind === "terminal" ? buildTerminal(content.demo) : null;

export const SCREENS: ScreensTimeline | null =
  content.demo.kind === "screens" ? buildScreens(content.demo) : null;

const BODY_DUR = TERMINAL ? TERMINAL.duration : SCREENS ? SCREENS.duration : 300;

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

/** Title bar label for the demo window. */
export const WINDOW_TITLE = content.windowTitle ?? content.name;
