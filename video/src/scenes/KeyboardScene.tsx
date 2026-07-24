import type { FC } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
} from "remotion";

import { MONO } from "../font";
import { placeKeys, type PlacedKey } from "../keyboard-layout";
import { withAlpha } from "../color";
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
 * hardware that no screen capture can show. The caption on the landing page
 * says so. Drawing the effect is fair; implying it was filmed would not be.
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
const GAP = 9;
const ROW_H = 68;

const { keys, width: KB_W, height: KB_H } = placeKeys(UNIT, GAP, ROW_H);

/** Aluminium body around the key well. */
const BODY_PAD_X = 96;
const BODY_PAD_TOP = 78;
const TRACKPAD_H = 232;
const BODY_W = KB_W + BODY_PAD_X * 2;
const BODY_H = KB_H + BODY_PAD_TOP + TRACKPAD_H + 74;

/** Warm white, the colour a real backlight actually is. */
const LIGHT = "#ffdfb8";

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

const Key: FC<{ k: PlacedKey; lit: number }> = ({ k, lit }) => (
  <div
    style={{
      position: "absolute",
      left: k.x,
      top: k.y,
      width: k.w,
      height: k.h,
      borderRadius: 9,
      background: "#141412",
      border: `1px solid ${withAlpha(LIGHT, 0.06 + lit * 0.22)}`,
      boxShadow: `0 0 ${10 + lit * 26}px ${withAlpha(LIGHT, lit * 0.4)}, inset 0 1px 0 ${withAlpha(LIGHT, lit * 0.3)}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    {/* the light bleeding out from under the cap, which is what a backlight
        actually looks like from above: brightest at the edges of the legend */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: `radial-gradient(120% 140% at 50% 115%, ${withAlpha(LIGHT, 0.5)}, ${withAlpha(LIGHT, 0)} 72%)`,
        opacity: lit,
      }}
    />
    {k.label ? (
      <span
        style={{
          position: "relative",
          fontFamily: MONO,
          fontSize: k.small ? 15 : 20,
          letterSpacing: k.small ? 0.2 : 0.6,
          // The legend is the light source: unlit it is nearly invisible,
          // exactly like the real thing in a dark room.
          color: withAlpha(LIGHT, 0.1 + lit * 0.85),
        }}
      >
        {k.label}
      </span>
    ) : null}
  </div>
);

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
    interpolate(frame, [KB_TYPE_AT, KB_TYPE_AT + KB_TYPE_FRAMES], [0, KB_COMMAND.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      // Linear, never eased: eased typing accelerates into the middle of a word
      // and reads as an animation. A human types at a steady rate.
    }),
  );
  const doneTyping = typed >= KB_COMMAND.length;

  // The ambient pool the keyboard throws onto the aluminium around it. It
  // follows the darkest key rather than leading it, so the room goes dark a
  // beat after the board does.
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
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 44 }}>
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

        {/* the machine */}
        <div
          style={{
            position: "relative",
            width: BODY_W,
            height: BODY_H,
            borderRadius: 40,
            background: "linear-gradient(180deg, #2a2a28 0%, #201f1e 40%, #1a1a19 100%)",
            border: `1px solid ${claude.border}`,
            boxShadow: `0 40px 120px rgba(0,0,0,0.55)`,
          }}
        >
          {/* light spilling onto the body around the keys */}
          <div
            style={{
              position: "absolute",
              left: BODY_PAD_X - 46,
              top: BODY_PAD_TOP - 40,
              width: KB_W + 92,
              height: KB_H + 80,
              borderRadius: 40,
              background: `radial-gradient(70% 80% at 50% 45%, ${withAlpha(LIGHT, 0.16)}, ${withAlpha(LIGHT, 0)} 70%)`,
              opacity: pool,
            }}
          />

          {/* the key well */}
          <div
            style={{
              position: "absolute",
              left: BODY_PAD_X,
              top: BODY_PAD_TOP,
              width: KB_W,
              height: KB_H,
            }}
          >
            {keys.map((k) => (
              <Key key={k.id} k={k} lit={keyLight(k, frame)} />
            ))}
          </div>

          {/* trackpad, present so the object reads as a MacBook and not as a
              standalone keyboard. Deliberately inert: it never lights. */}
          <div
            style={{
              position: "absolute",
              left: (BODY_W - 560) / 2,
              top: BODY_PAD_TOP + KB_H + 44,
              width: 560,
              height: TRACKPAD_H - 60,
              borderRadius: 16,
              background: "#161615",
              border: `1px solid ${withAlpha(LIGHT, 0.05)}`,
            }}
          />
        </div>
      </div>
    </AbsoluteFill>
  );
};
