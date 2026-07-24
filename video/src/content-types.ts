/**
 * The shape of `content.ts`.
 *
 * `content.ts` is the ONLY file that changes from project to project. This file
 * is the contract it has to satisfy, and it is deliberately kept separate so
 * that rewriting `content.ts` can never break the types it is checked against.
 *
 * Every field is documented on the type below, and again with worked examples
 * in `content.ts` itself and in `TEMPLATE.md`.
 */

import type { Span } from "./spans";

/**
 * One row of terminal output.
 *
 * Produce these with `fromAnsi()` from `ansi.ts`, which turns real captured
 * stdout (escape codes and all) into spans. Hand-writing spans is only for
 * lines you are inventing rather than capturing.
 */
export type TermLine = {
  spans: Span[];
  /**
   * How many rows the line occupies on screen. Only set this above 1 for a line
   * you also mark `wrap: true`; it reserves the vertical space the wrap needs so
   * the scroll maths stay correct.
   */
  rows?: number;
  /** Allow soft wrapping. Off by default: terminal output does not reflow. */
  wrap?: boolean;
  /**
   * Extra frames of pause before the NEXT line appears, at 30fps. Use it to let
   * a result land: 15 is half a second. Default 0.
   */
  pause?: number;
};

/**
 * A captured CLI run: one command typed at a prompt, then its real output.
 * Use this for anything that lives in a terminal.
 */
export type TerminalDemo = {
  kind: "terminal";
  /**
   * The command, typed out character by character on screen. Keep it short
   * enough to read in one glance: this is the thing viewers copy.
   */
  command: string;
  /** The captured stdout, one entry per line, in order. */
  lines: TermLine[];
};

/** One captured screenshot of a running app. */
export type Shot = {
  /**
   * Path relative to `public/`, for example `screens/01-dashboard.png`.
   * PNG, captured from a LOCAL dev server. Do not link a remote URL: the render
   * must stay offline and deterministic.
   */
  src: string;
  /** One short line under the window saying what the viewer is looking at. */
  caption?: string;
  /** How long this shot holds, in frames at 30fps. Default 90 (3 seconds). */
  holdFrames?: number;
};

/**
 * A captured UI walkthrough. Use this for anything with a browser in it.
 */
export type ScreensDemo = {
  kind: "screens";
  shots: Shot[];
};

export type DemoPayload = TerminalDemo | ScreensDemo;

export type Content = {
  /** Project name, exactly as it should be written. Shown next to the mark. */
  name: string;
  /** The promise, in under about 60 characters. See TEMPLATE.md for the test. */
  tagline: string;
  /** One line of plain prose, under about 100 characters. */
  description: string;
  /** The single command that installs or runs it, without a leading `$`. */
  install: string;
  /** Repository, written the way a human reads it: `github.com/user/repo`. */
  repoUrl: string;
  /**
   * Accent colour, one hex value. Everything coral in the frame follows it: the
   * mark, the cursor, the prompt caret, the `$`, the background wash.
   * Defaults to the Claude coral `#d97757`, which is the house colour. Override
   * only when the project already has a brand colour of its own.
   */
  accent?: string;
  /**
   * Two to four very short claims, shown as one line on the banner.
   * Example: `["read-only", "zero deps", "offline"]`.
   */
  highlights?: string[];
  /**
   * The opening title cards, one string per line, at most three lines. The last
   * line is emphasised, so put the payoff there. Omit to derive them from
   * `description` and `tagline`.
   */
  coldOpen?: string[];
  /** Label in the window title bar. Defaults to `name`. */
  windowTitle?: string;
  /** What the demo actually shows. */
  demo: DemoPayload;
};
