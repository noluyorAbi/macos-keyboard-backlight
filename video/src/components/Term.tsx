import type { CSSProperties, FC } from "react";
import { Easing, interpolate } from "remotion";

import { MONO } from "../font";
import { claude, easing, TERM } from "../theme";
import { sliceSpans, spanLen, type Span } from "../spans";

/**
 * THE LIGATURE FIX. Non-optional.
 *
 * JetBrains Mono ships code ligatures, and the two hyphens in a CLI flag like
 * `--since` fuse into a single long dash glyph that reads on screen exactly
 * like an em dash. Beyond looking wrong, it is not the character the user
 * types, so anyone copying the command off the video gets it wrong. Turning off
 * `liga` and `calt` keeps `--since` as two visible hyphens. The same applies to
 * Fira Code, Cascadia and most other coding fonts.
 */
export const termText: CSSProperties = {
  fontFamily: MONO,
  fontSize: TERM.fontSize,
  lineHeight: `${TERM.lineHeight}px`,
  fontVariantLigatures: "none",
  fontFeatureSettings: '"liga" 0, "calt" 0',
  whiteSpace: "pre",
  letterSpacing: 0,
};

/** Shared monospace base for everything outside the terminal buffer. */
export const mono: CSSProperties = {
  fontFamily: MONO,
  fontVariantLigatures: "none",
  fontFeatureSettings: '"liga" 0, "calt" 0',
  whiteSpace: "pre",
};

/** Octicons git-branch. U+2387 is missing from every monospace webfont. */
const BranchIcon: FC<{ color?: string; size: number }> = ({ color, size }) => (
  <span
    style={{
      display: "inline-block",
      width: `${size * 0.6}px`,
      textAlign: "center",
      verticalAlign: "baseline",
    }}
  >
    <svg
      viewBox="0 0 16 16"
      width={size * 0.78}
      height={size * 0.78}
      fill={color ?? "currentColor"}
      style={{ verticalAlign: -size * 0.11 }}
    >
      <path d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
    </svg>
  </span>
);

/** Draw a span array. `size` only matters for the SVG glyph fallbacks. */
export const SpanRun: FC<{ spans: Span[]; size?: number }> = ({
  spans,
  size = TERM.fontSize,
}) => (
  <>
    {spans.map((s, i) => {
      if (s.icon === "branch") {
        // the glyph is never drawn as text, so a missing codepoint cannot tofu
        return s.text.length > 0 ? (
          <BranchIcon key={i} color={s.color} size={size} />
        ) : null;
      }
      return (
        <span key={i} style={{ color: s.color, fontWeight: s.bold ? 700 : 400 }}>
          {s.text}
        </span>
      );
    })}
  </>
);

/**
 * Terminal cursor. A square wave, not an opacity fade: a fade reads as a web
 * spinner, a hard on/off reads as a shell. Solid while characters are being
 * typed, blinking only once the line is finished, which is what a real shell
 * does and what makes it read as convincing.
 */
export const Cursor: FC<{
  frame: number;
  fps: number;
  blink: boolean;
  size?: number;
}> = ({ frame, fps, blink, size = TERM.fontSize }) => {
  const period = Math.round(fps * 1.06);
  const on = !blink || Math.floor(frame % period) < period / 2;
  return (
    <span
      style={{
        display: "inline-block",
        width: `${size * 0.6}px`,
        height: `${size * 1.15}px`,
        background: claude.clay,
        opacity: on ? 1 : 0,
        transform: `translateY(${size * 0.2}px)`,
      }}
    />
  );
};

/**
 * Per-character reveal, derived purely from the frame.
 *
 * Never useState/setInterval: Remotion renders frames out of order and in
 * parallel across browser tabs, so any stateful or wall-clock animation
 * produces corrupted, nondeterministic output. The revealed character count is
 * a pure function of `frame`.
 *
 * Typing is linear, not eased, for the reason given in `timeline.ts`.
 */
export const TypedLine: FC<{
  spans: Span[];
  sceneFrame: number;
  /** the prompt caret appears here */
  from: number;
  /** the first character is typed here */
  typeAt: number;
  cps: number;
  fps: number;
  /** Enter is pressed here: the cursor leaves with the submitted line */
  submitAt: number;
}> = ({ spans, sceneFrame, from, typeAt, cps, fps, submitAt }) => {
  // the row is always in the document flow so the buffer never reflows, but
  // nothing is drawn until the shell actually reaches this prompt
  if (sceneFrame < from) {
    return <div style={{ ...termText, height: TERM.lineHeight }} />;
  }

  const total = spanLen(spans);
  // the prompt caret ("> ") is already on screen; only the command is typed
  const prefix = spans.length > 0 ? spans[0].text.length : 0;
  const typable = total - prefix;
  const chars = Math.floor(
    interpolate(sceneFrame - typeAt, [0, (typable / cps) * fps], [0, typable], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  const typing = sceneFrame >= typeAt && chars < typable;
  const submitted = sceneFrame >= submitAt;

  return (
    <div style={{ ...termText, height: TERM.lineHeight }}>
      <SpanRun spans={sliceSpans(spans, prefix + chars)} />
      {submitted ? null : (
        // solid while keys are landing, blinking while the prompt waits
        <Cursor frame={sceneFrame} fps={fps} blink={!typing} />
      )}
    </div>
  );
};

/**
 * Output line entrance: opacity plus a 6px lift, over 8 frames (267ms), with
 * the house ease-out curve. No spring, no bounce, no scale. Text that bounces
 * is text you cannot read.
 */
export const OutLine: FC<{
  spans: Span[];
  sceneFrame: number;
  from: number;
  rows: number;
  wrap: boolean;
}> = ({ spans, sceneFrame, from, rows, wrap }) => {
  const local = sceneFrame - from;
  const t = interpolate(local, [0, 8], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  return (
    <div
      style={{
        ...termText,
        height: rows * TERM.lineHeight,
        whiteSpace: wrap ? "pre-wrap" : "pre",
        opacity: t,
        transform: `translateY(${interpolate(t, [0, 1], [6, 0])}px)`,
      }}
    >
      <SpanRun spans={spans} />
    </div>
  );
};
