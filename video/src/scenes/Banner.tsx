import type { FC } from "react";
import { AbsoluteFill } from "remotion";

import { Highlights, InstallPill, Mark, Tagline } from "../components/Brand";
import { Proof } from "../components/Proof";
import { withAlpha } from "../color";
import { content } from "../content";
import { accent, claude } from "../theme";

/**
 * README hero banner, 1584x396 (the LinkedIn 4:1 ratio, which also sits well at
 * the top of a README), rendered as a still to assets/banner.png.
 *
 * Design intent: this is not a logo card, it is a product shot. The left is the
 * brand lockup, the promise, the one install command, and the claims the
 * project actually keeps. The right is a real slice of the demo in the same
 * window chrome. Colour is spent the way the terminal spends it: dark surface,
 * one reserved accent, nothing decorative.
 */

const PAD_X = 64;
const PAD_Y = 44;
const LEFT_W = 556;
const GAP = 56;

/** Shrink the lockup rather than let a long name collide with the product shot. */
const markSize = Math.max(
  40,
  Math.min(78, Math.floor(LEFT_W / ((content.name.length + 2) * 0.6))),
);

export const Banner: FC = () => (
  <AbsoluteFill style={{ background: claude.frame }}>
    {/* accent radial lift, weighted toward the brand lockup */}
    <AbsoluteFill
      style={{
        background: `radial-gradient(1150px 560px at 26% 42%, ${withAlpha(accent, 0.14)}, ${withAlpha(accent, 0)} 60%)`,
      }}
    />

    <AbsoluteFill
      style={{
        padding: `${PAD_Y}px ${PAD_X}px`,
        display: "flex",
        flexDirection: "row",
        alignItems: "center",
        gap: GAP,
      }}
    >
      <div
        style={{
          width: LEFT_W,
          display: "flex",
          flexDirection: "column",
          gap: 22,
        }}
      >
        <Mark size={markSize} />
        <div style={{ width: LEFT_W }}>
          <Tagline size={24} />
        </div>
        <InstallPill size={22} padding="12px 20px" />
        <Highlights size={18} />
      </div>

      <div style={{ flex: 1, display: "flex", justifyContent: "flex-end" }}>
        <Proof
          width={1584 - PAD_X * 2 - LEFT_W - GAP}
          height={396 - PAD_Y * 2}
          rows={8}
          maxFont={17}
          titlebarH={38}
        />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
