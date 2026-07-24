import type { FC } from "react";

import { withAlpha } from "../color";
import { fitUnit, KeyWell, LIGHT } from "./Keyboard";

/**
 * The product, as proof, on a still: a lit keyboard, fitted to a box.
 *
 * The stills used to carry a slice of terminal output in window chrome. That is
 * the right choice for a tool whose output is its product, and the wrong one
 * here: this tool's visible output is a single number, and what it actually
 * changes is the light under the keys. So the stills show the light.
 *
 * No window chrome around it, deliberately. A keyboard is hardware; framing it
 * in a title bar would say "screenshot of an app", which is the one thing this
 * picture is not.
 *
 * The key well alone, without the aluminium body: at banner height the body
 * would eat most of the box for a trackpad nobody needs to see.
 */

export const KeyboardProof: FC<{
  width: number;
  height: number;
  /** Ceiling on the key size, so a wide card does not get an absurd keyboard. */
  maxUnit?: number;
}> = ({ width, height, maxUnit = 64 }) => {
  // Measured through the same placeKeys the video uses. Never restate the row
  // count or the gap and row height ratios here: a second copy of those numbers
  // mis-sizes only the stills, and nothing would catch it but a human eye.
  const unit = fitUnit(width, height, maxUnit);

  return (
    <div
      style={{
        width,
        height,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "relative",
      }}
    >
      {/* the pool of light the board throws, so it sits in a room rather than
          floating on the card background */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: `radial-gradient(60% 70% at 50% 50%, ${withAlpha(LIGHT, 0.12)}, ${withAlpha(LIGHT, 0)} 72%)`,
        }}
      />
      <div style={{ position: "relative" }}>
        <KeyWell unit={unit} lit={() => 1} />
      </div>
    </div>
  );
};
