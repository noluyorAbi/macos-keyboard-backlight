import type { FC } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { withAlpha } from "../color";
import { MacBook } from "../components/Keyboard";
import { MONO } from "../font";
import { accent, ansi, claude, easing } from "../theme";
import { PULSE_DONE_AT, PULSE_DURATION, pulseLight } from "../timeline";

/**
 * The hook shot: an agent finishes, and the keyboard says so.
 *
 * WHAT THIS IS AND IS NOT
 *
 * The rhythm is the shipped default of `kbdlight pulse`, frame for frame. The
 * MacBook is an illustration, because the thing this tool changes is hardware
 * that no screen recording can show, and both READMEs say so under the asset.
 * Drawing the effect is fair; implying it was filmed would not be.
 *
 * MOTION BRIEF
 *
 * One expressive moment, and it is not eased. The blink is a square wave
 * because the hardware is: measured through `backlightLevelForKeyboard:`, the
 * LEDs reach full inside 26 ms, less than a frame here. Every key changes
 * together, because a MacBook backlight is a single zone and a wave would be
 * inventing hardware that does not exist.
 *
 * Everything else holds still. The only other animation is the working dot,
 * which is allowed to breathe precisely because it does mean "loading".
 *
 * The first and last frames are the same idle keyboard, so the GIF loops with
 * no seam, and the shot ends by restoring the level it started from, which is
 * also the guarantee the command itself makes.
 */

const UNIT = 74;

export const PulseScene: FC = () => {
  const frame = useCurrentFrame();

  const enter = interpolate(frame, [0, 18], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  const leave = interpolate(
    frame,
    [PULSE_DURATION - 14, PULSE_DURATION],
    [1, 0],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  const done = frame >= PULSE_DONE_AT;
  const lit = pulseLight(frame);

  // The dot breathes while the agent is working, and stops dead when it is not.
  const working = 0.45 + 0.55 * Math.abs(Math.sin(frame / 9));

  // The room follows the board exactly: no lag, because at this speed a
  // trailing pool smears the square edges the shot exists to show, and no
  // floor, because at level 0 a real backlight throws no light at all. An
  // earlier version kept a dim floor here and the dark phase measured within
  // 8% of the idle state, which is another way of saying it was invisible.
  const pool = lit;

  return (
    <AbsoluteFill style={{ background: claude.frame }}>
      {/* The same static wash the Demo composition sits on. Stated here rather
          than inherited, because this scene is also its own composition: left
          transparent, the GIF encoder decides the backdrop for us and the still
          renders on white. */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(1200px 700px at 50% 45%, ${withAlpha(accent, 0.055)}, ${withAlpha(accent, 0)} 70%)`,
        }}
      />

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
              gap: 18,
              alignItems: "center",
              minWidth: 760,
            }}
          >
            <span
              style={{
                width: 14,
                height: 14,
                borderRadius: 7,
                background: done ? ansi.ok : claude.dim,
                opacity: done ? 1 : working,
              }}
            />
            <span style={{ color: claude.dim }}>claude code</span>
            <span style={{ color: done ? ansi.ok : claude.dim }}>
              {done ? "response ready" : "working"}
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: 24,
                color: withAlpha(accent, done ? 1 : 0.35),
              }}
            >
              kbdlight pulse
            </span>
          </div>

          <MacBook unit={UNIT} lit={() => lit} pool={pool} />
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
