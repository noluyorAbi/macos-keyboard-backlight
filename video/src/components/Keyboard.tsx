import type { FC } from "react";

import { withAlpha } from "../color";
import { MONO } from "../font";
import { placeKeys, type PlacedKey } from "../keyboard-layout";
import { claude } from "../theme";

/**
 * The product, drawn: a MacBook keyboard whose backlight can be dimmed key by
 * key.
 *
 * Shared by the video scene and by both stills, so the object is identical
 * everywhere it appears. The scene passes a `lit` function that changes with
 * the frame; the stills pass one that always returns 1. Nothing else differs,
 * which is what stops the banner and the video drifting into two different
 * looking keyboards.
 *
 * One size input, `unit`, drives everything. Gap and row height are derived
 * from it so a keyboard sized for a 1584 wide banner and one sized for a 1920
 * frame stay the same object at two scales rather than two different objects.
 */

/** Warm white, the colour a real backlight actually is. */
export const LIGHT = "#ffdfb8";

export const gapFor = (unit: number): number => Math.round(unit * 0.12);
export const rowHFor = (unit: number): number => Math.round(unit * 0.92);

export const keyboardSize = (unit: number): { w: number; h: number } => {
  const { width, height } = placeKeys(unit, gapFor(unit), rowHFor(unit));
  return { w: width, h: height };
};

const Key: FC<{ k: PlacedKey; lit: number; unit: number }> = ({
  k,
  lit,
  unit,
}) => (
  <div
    style={{
      position: "absolute",
      left: k.x,
      top: k.y,
      width: k.w,
      height: k.h,
      borderRadius: Math.max(4, unit * 0.12),
      background: "#141412",
      border: `1px solid ${withAlpha(LIGHT, 0.06 + lit * 0.22)}`,
      boxShadow: `0 0 ${unit * 0.14 + lit * unit * 0.35}px ${withAlpha(LIGHT, lit * 0.4)}, inset 0 1px 0 ${withAlpha(LIGHT, lit * 0.3)}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
    }}
  >
    {/* The light bleeding out from under the cap. Brightest at the bottom edge,
        which is where a real backlight escapes. */}
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
          fontSize: unit * (k.small ? 0.2 : 0.27),
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

/** Just the key well, no aluminium around it. Used where space is tight. */
export const KeyWell: FC<{
  unit: number;
  lit: (k: PlacedKey) => number;
}> = ({ unit, lit }) => {
  const gap = gapFor(unit);
  const rowH = rowHFor(unit);
  const { keys, width, height } = placeKeys(unit, gap, rowH);
  return (
    <div style={{ position: "relative", width, height }}>
      {keys.map((k) => (
        <Key key={k.id} k={k} lit={lit(k)} unit={unit} />
      ))}
    </div>
  );
};

/**
 * The whole machine: key well, the aluminium around it, a trackpad, and the
 * pool of light the keyboard throws onto the body.
 *
 * `pool` is separate from the per key `lit` because the room goes dark a beat
 * after the board does, and driving both from the same number loses that.
 */
export const MacBook: FC<{
  unit: number;
  lit: (k: PlacedKey) => number;
  pool: number;
}> = ({ unit, lit, pool }) => {
  const { w: kbW, h: kbH } = keyboardSize(unit);
  const padX = Math.round(unit * 1.3);
  const padTop = Math.round(unit * 1.05);
  const trackpadH = Math.round(unit * 3.1);
  const bodyW = kbW + padX * 2;
  const bodyH = kbH + padTop + trackpadH + Math.round(unit);

  return (
    <div
      style={{
        position: "relative",
        width: bodyW,
        height: bodyH,
        borderRadius: unit * 0.54,
        background:
          "linear-gradient(180deg, #2a2a28 0%, #201f1e 40%, #1a1a19 100%)",
        border: `1px solid ${claude.border}`,
        boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
      }}
    >
      {/* light spilling onto the body around the keys */}
      <div
        style={{
          position: "absolute",
          left: padX - unit * 0.6,
          top: padTop - unit * 0.55,
          width: kbW + unit * 1.2,
          height: kbH + unit * 1.1,
          borderRadius: unit * 0.54,
          background: `radial-gradient(70% 80% at 50% 45%, ${withAlpha(LIGHT, 0.16)}, ${withAlpha(LIGHT, 0)} 70%)`,
          opacity: pool,
        }}
      />

      <div style={{ position: "absolute", left: padX, top: padTop }}>
        <KeyWell unit={unit} lit={lit} />
      </div>

      {/* Present so the object reads as a MacBook rather than as a standalone
          keyboard. Deliberately inert: it never lights. */}
      <div
        style={{
          position: "absolute",
          left: (bodyW - unit * 7.6) / 2,
          top: padTop + kbH + unit * 0.6,
          width: unit * 7.6,
          height: trackpadH - unit * 0.8,
          borderRadius: unit * 0.22,
          background: "#161615",
          border: `1px solid ${withAlpha(LIGHT, 0.05)}`,
        }}
      />
    </div>
  );
};
