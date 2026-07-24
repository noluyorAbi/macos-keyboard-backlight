import type { FC, ReactNode } from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";

import { InstallPill, Mark, RepoLine, Tagline } from "../components/Brand";
import { easing } from "../theme";
import { END_CARD_DUR, END_CARD_FADE_OUT } from "../timeline";

/** Entrances only, staggered. The frame then holds, completely still. */
const Row: FC<{ frame: number; at: number; children: ReactNode }> = ({
  frame,
  at,
  children,
}) => {
  const t = interpolate(frame, [at, at + 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  return (
    <div
      style={{
        opacity: t,
        transform: `translateY(${interpolate(t, [0, 1], [8, 0])}px)`,
        display: "flex",
        justifyContent: "center",
      }}
    >
      {children}
    </div>
  );
};

/**
 * The card the viewer is left on: what it is called, what it promises, the one
 * command, and where to find it. Four rows, staggered in, then dead still.
 *
 * The whole card fades back out at the end. That is not decoration: it returns
 * the last frame to the same empty background as frame 0, so the GIF loops
 * without a seam. See the note in `timeline.ts`.
 */
export const EndCard: FC = () => {
  const frame = useCurrentFrame();
  const inT = interpolate(frame, [0, 20], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // the fade lands on zero at the LAST rendered frame (duration - 1), so the
  // final frame is the same empty background as frame 0
  const outT = interpolate(
    frame,
    [END_CARD_DUR - 1 - END_CARD_FADE_OUT, END_CARD_DUR - 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: inT * outT,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 26,
        }}
      >
        <Row frame={frame} at={6}>
          <Mark size={64} />
        </Row>

        <Row frame={frame} at={16}>
          <Tagline size={28} />
        </Row>

        <Row frame={frame} at={28}>
          <div style={{ marginTop: 12, display: "flex" }}>
            <InstallPill size={30} />
          </div>
        </Row>

        <Row frame={frame} at={40}>
          <div style={{ marginTop: 4 }}>
            <RepoLine size={24} />
          </div>
        </Row>
      </div>
    </AbsoluteFill>
  );
};
