import type { FC } from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";

import { mono } from "../components/Term";
import { Window } from "../components/Window";
import { ansi, claude, easing, SHOT_WINDOW_H, SHOT_WINDOW_W } from "../theme";
import { SCREENS, SHOT_FADE, WINDOW_TITLE } from "../timeline";

const timeline = SCREENS;

/**
 * The screenshot walkthrough.
 *
 * Every shot lives in the same window chrome the terminal demo uses, so a web
 * project and a CLI project read as the same family of launch video.
 *
 * Motion, deliberately minimal:
 *
 *   - Shots cross dissolve over 14 frames. A slide would imply the app itself
 *     navigated sideways, which it did not; a dissolve just says "next".
 *   - The incoming shot settles from scale(1.012) to scale(1) on the same
 *     curve. That is the only movement, it is under half a second, and it never
 *     exposes an edge of the window because the image only ever shrinks into
 *     place. No drifting Ken Burns pan: a UI screenshot that keeps moving is
 *     one you cannot read.
 *   - Nothing moves during the hold. The hold is the point.
 */
export const ScreensScene: FC = () => {
  const sceneFrame = useCurrentFrame();

  if (!timeline || timeline.beats.length === 0) {
    return null;
  }

  const enter = interpolate(sceneFrame, [timeline.windowIn, timeline.windowIn + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  const leave = interpolate(
    sceneFrame,
    [timeline.duration - 16, timeline.duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: enter * leave,
        transform: `translateY(${interpolate(enter, [0, 1], [8, 0])}px)`,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 20,
        }}
      >
        <Window
          title={WINDOW_TITLE}
          width={SHOT_WINDOW_W}
          height={SHOT_WINDOW_H}
          bodyStyle={{ overflow: "hidden", background: claude.bg }}
        >
          {timeline.beats.map((beat, i) => {
            const next = timeline.beats[i + 1];
            const inT = interpolate(
              sceneFrame,
              [beat.from, beat.from + SHOT_FADE],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(...easing.out),
              },
            );
            const outT = next
              ? interpolate(sceneFrame, [next.from, next.from + SHOT_FADE], [1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1;
            const opacity = inT * outT;
            if (opacity <= 0) {
              return null;
            }
            return (
              <AbsoluteFill key={beat.src} style={{ opacity }}>
                <Img
                  src={staticFile(beat.src)}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    objectPosition: "top center",
                    display: "block",
                    transform: `scale(${interpolate(inT, [0, 1], [1.012, 1])})`,
                  }}
                />
              </AbsoluteFill>
            );
          })}
        </Window>

        {/* caption rail: fixed height so the window never shifts vertically */}
        <div style={{ height: 34, position: "relative", width: SHOT_WINDOW_W }}>
          {timeline.beats.map((beat, i) => {
            if (!beat.caption) {
              return null;
            }
            const next = timeline.beats[i + 1];
            const inT = interpolate(
              sceneFrame,
              [beat.from + 4, beat.from + 4 + SHOT_FADE],
              [0, 1],
              {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
                easing: Easing.bezier(...easing.out),
              },
            );
            const outT = next
              ? interpolate(sceneFrame, [next.from, next.from + 8], [1, 0], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })
              : 1;
            const opacity = inT * outT;
            if (opacity <= 0) {
              return null;
            }
            return (
              <div
                key={beat.src}
                style={{
                  ...mono,
                  position: "absolute",
                  left: 0,
                  right: 0,
                  textAlign: "center",
                  fontSize: 24,
                  color: ansi.sec,
                  opacity,
                  transform: `translateY(${interpolate(inT, [0, 1], [4, 0])}px)`,
                }}
              >
                {beat.caption}
              </div>
            );
          })}
        </div>
      </div>
    </AbsoluteFill>
  );
};
