import type { FC } from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

import { OutLine, TypedLine } from "../components/Term";
import { Window } from "../components/Window";
import {
  claude,
  PAD_X,
  PAD_Y,
  TERM,
  VIEWPORT_H,
  WINDOW_H,
  WINDOW_W,
  easing,
} from "../theme";
import { CPS, TERMINAL, WINDOW_TITLE } from "../timeline";

const timeline = TERMINAL;

const target = (rows: number): number =>
  Math.max(0, rows * TERM.lineHeight - VIEWPORT_H);

/**
 * The pane scrolls the way a terminal scrolls: content grows downward, and once
 * it passes the bottom of the viewport the whole buffer slides up. That is what
 * lets the type stay large instead of being shrunk to fit every row at once.
 *
 * The offset is a pure function of the frame. For the most recently revealed
 * line we ease from the previous scroll target to the new one, so the buffer
 * glides by one row rather than jumping.
 */
const scrollOffset = (sceneFrame: number): number => {
  if (!timeline) {
    return 0;
  }
  const { lines, rowOffsets } = timeline;
  let k = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].from <= sceneFrame) {
      k = i;
    }
  }
  if (k < 0) {
    return 0;
  }
  const rowsAfter = (i: number): number => rowOffsets[i] + lines[i].rows;

  const from = k > 0 ? target(rowsAfter(k - 1)) : 0;
  const to = target(rowsAfter(k));
  if (from === to) {
    return to;
  }
  const t = interpolate(sceneFrame, [lines[k].from, lines[k].from + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  return interpolate(t, [0, 1], [from, to]);
};

export const TerminalScene: FC = () => {
  const sceneFrame = useCurrentFrame();
  const { fps } = useVideoConfig();

  if (!timeline) {
    return null;
  }

  // window enters: opacity plus an 8px lift, 10 frames (333ms), ease-out
  const enter = interpolate(sceneFrame, [timeline.windowIn, timeline.windowIn + 10], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(...easing.out),
  });
  // the exit is plainer than the entrance on purpose: attention is already
  // moving on to the end card, so it fades without moving
  const leave = interpolate(
    sceneFrame,
    [timeline.duration - 16, timeline.duration],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const scroll = scrollOffset(sceneFrame);

  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        opacity: enter * leave,
        transform: `translateY(${interpolate(enter, [0, 1], [8, 0])}px)`,
      }}
    >
      <Window
        title={WINDOW_TITLE}
        width={WINDOW_W}
        height={WINDOW_H}
        bodyStyle={{ padding: `${PAD_Y}px ${PAD_X}px`, overflow: "hidden" }}
      >
        {/*
          The scrollback is clipped to its own viewport box, not to the pane.
          Without this the buffer scrolls up into the pane's padding and lines
          get sliced in half against the title bar. The mask softens the top
          edge so a line leaving the buffer dissolves instead of being
          guillotined.
        */}
        <div
          style={{
            height: VIEWPORT_H,
            overflow: "hidden",
            background: claude.bg,
            maskImage: "linear-gradient(to bottom, transparent 0, #000 20px)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 20px)",
          }}
        >
          <div style={{ transform: `translateY(${-scroll}px)` }}>
            {timeline.lines.map((line) =>
              line.kind === "typed" ? (
                <TypedLine
                  key={line.key}
                  spans={line.spans}
                  sceneFrame={sceneFrame}
                  from={line.from}
                  typeAt={line.typeAt ?? line.from}
                  cps={CPS}
                  fps={fps}
                  submitAt={line.submitAt ?? Number.MAX_SAFE_INTEGER}
                />
              ) : (
                <OutLine
                  key={line.key}
                  spans={line.spans}
                  sceneFrame={sceneFrame}
                  from={line.from}
                  rows={line.rows}
                  wrap={line.wrap}
                />
              ),
            )}
          </div>
        </div>
      </Window>
    </AbsoluteFill>
  );
};
