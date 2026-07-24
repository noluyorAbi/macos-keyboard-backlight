import type { FC } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { Cursor } from "../components/Term";
import { MONO } from "../font";
import { claude, easing } from "../theme";
import { COLD_OPEN_DUR, COLD_OPEN_LINES } from "../timeline";

/**
 * The problem, or the promise, stated once before anything moves.
 *
 * Lines are staggered 20 frames apart and rise 10px into place over 12 frames.
 * The last line is the payoff, so it gets the bright weight and the cursor: the
 * first accent on screen, and the bridge into the window that follows.
 *
 * Type is sized to the longest line so nothing wraps. Keep cold open lines
 * under about 42 characters to get the full 54px.
 */
const longest = COLD_OPEN_LINES.reduce((n, l) => Math.max(n, l.length), 1);
const FONT_SIZE = Math.max(26, Math.min(54, Math.floor(1500 / (longest * 0.6))));

export const ColdOpen: FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leave = interpolate(frame, [COLD_OPEN_DUR - 20, COLD_OPEN_DUR], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: leave,
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: FONT_SIZE * 0.26 }}>
        {COLD_OPEN_LINES.map((line, i) => {
          const start = 10 + i * 20;
          const t = interpolate(frame, [start, start + 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(...easing.out),
          });
          const last = i === COLD_OPEN_LINES.length - 1;
          return (
            <div
              key={line}
              style={{
                fontFamily: MONO,
                fontSize: FONT_SIZE,
                lineHeight: 1.35,
                color: last ? claude.bright : claude.dim,
                fontWeight: last ? 700 : 400,
                fontVariantLigatures: "none",
                fontFeatureSettings: '"liga" 0, "calt" 0',
                whiteSpace: "pre",
                opacity: t,
                transform: `translateY(${interpolate(t, [0, 1], [10, 0])}px)`,
              }}
            >
              {line}
              {last && frame >= start + 12 ? (
                <>
                  {" "}
                  <Cursor frame={frame} fps={fps} blink size={FONT_SIZE} />
                </>
              ) : null}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
