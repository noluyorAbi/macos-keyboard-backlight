import type { FC } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { MacBook } from "../components/Keyboard";
import { MONO } from "../font";
import type { PlacedKey } from "../keyboard-layout";
import { accent, claude, easing } from "../theme";
import {
  KB_COMMAND,
  KB_DUR,
  KB_SWEEP_AT,
  KB_SWEEP_KEY_FRAMES,
  KB_SWEEP_SPREAD,
  KB_TYPE_AT,
  KB_TYPE_FRAMES,
} from "../timeline";

/**
 * The payoff shot: a MacBook seen from above, its keyboard lit, a real command
 * typed, and the backlight going out under it.
 *
 * WHAT THIS IS AND IS NOT
 *
 * The command is real and does exactly what it says. The MacBook is an
 * illustration, not a screen recording, because the thing this tool changes is
 * hardware that no screen capture can show. The README and the landing caption
 * both say so. Drawing the effect is fair; implying it was filmed would not be.
 *
 * MOTION BRIEF
 *
 * One expressive moment, and it is the sweep. Its job is to make an invisible
 * hardware state change legible, so it is not decoration and it earns the extra
 * frames. Everything else in the shot deliberately holds still.
 *
 *   - The lit state is steady. No breathing, no pulsing glow: a looped pulse
 *     would read as "loading", and it ages badly.
 *   - The light leaves as a diagonal wave (see `t` in keyboard-layout), not as
 *     a curtain and not all at once. All at once reads as a cut; a wave reads
 *     as a physical thing draining.
 *   - Per key the fade is ~370ms on an ease-out curve, which is how an LED
 *     actually falls off: fast at first, then a long tail.
 *   - Only opacity and filter animate. No key ever moves, because keys that
 *     drift look like a broken layout, not like light.
 *
 * ACCESSIBILITY
 *
 * This renders to a video file, so `prefers-reduced-motion` cannot live inside
 * it; the landing page gates autoplay behind that query instead, and the poster
 * is a still rather than an animated GIF. The motion here is vestibular-safe by
 * construction: nothing zooms, spins or parallaxes, and the sweep is a single
 * monotonic fade with no flashing.
 */

const UNIT = 74;

/**
 * How lit one key is at this frame, 0 to 1.
 *
 * Before the sweep every key sits at 1. The sweep hands each key its own start
 * frame from its position on the diagonal, then fades it out over
 * KB_SWEEP_KEY_FRAMES on the house ease-out curve.
 */
const keyLight = (key: PlacedKey, frame: number): number => {
  const start = KB_SWEEP_AT + key.t * KB_SWEEP_SPREAD;
  return interpolate(frame, [start, start + KB_SWEEP_KEY_FRAMES], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
};

export const KeyboardScene: FC = () => {
  const frame = useCurrentFrame();

  // Enter: opacity, a 14px rise and a blur that resolves. Cookbook enter recipe.
  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  // Exit is subtler than the enter on purpose: no rise, just a fade, because by
  // then the viewer is already leaving for the end card.
  const leave = interpolate(frame, [KB_DUR - 18, KB_DUR], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  const typed = Math.floor(
    interpolate(
      frame,
      [KB_TYPE_AT, KB_TYPE_AT + KB_TYPE_FRAMES],
      [0, KB_COMMAND.length],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
        // Linear, never eased: eased typing accelerates into the middle of a
        // word and reads as an animation. A human types at a steady rate.
      },
    ),
  );
  const doneTyping = typed >= KB_COMMAND.length;

  // The ambient pool follows the darkest key rather than leading it, so the
  // room goes dark a beat after the board does.
  const pool = interpolate(
    frame,
    [KB_SWEEP_AT, KB_SWEEP_AT + KB_SWEEP_SPREAD + KB_SWEEP_KEY_FRAMES + 8],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.bezier(...easing.out),
    },
  );

  return (
    <AbsoluteFill
      style={{
        alignItems: "center",
        justifyContent: "center",
        opacity: enter * leave,
        transform: `translateY(${(1 - enter) * 14}px)`,
        filter: `blur(${(1 - enter) * 8}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 44,
        }}
      >
        {/* the command, in the same chrome language as the rest of the video */}
        <div
          style={{
            fontFamily: MONO,
            fontSize: 30,
            letterSpacing: 0.4,
            color: claude.text,
            background: claude.bg,
            border: `1px solid ${claude.border}`,
            borderRadius: 12,
            padding: "18px 30px",
            display: "flex",
            gap: 14,
            alignItems: "baseline",
            minWidth: 760,
          }}
        >
          <span style={{ color: accent }}>{">"}</span>
          <span>
            {KB_COMMAND.slice(0, typed)}
            {!doneTyping ? (
              <span
                style={{
                  display: "inline-block",
                  width: 15,
                  height: 26,
                  background: accent,
                  transform: "translateY(3px)",
                }}
              />
            ) : null}
          </span>
        </div>

        <MacBook unit={UNIT} lit={(k) => keyLight(k, frame)} pool={pool} />
      </div>
    </AbsoluteFill>
  );
};
