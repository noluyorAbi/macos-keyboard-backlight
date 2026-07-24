import type { FC } from "react";
import { Img, staticFile } from "remotion";

import { content } from "../content";
import { mono, SpanRun } from "./Term";
import { Window } from "./Window";
import { ansi, claude, TERM } from "../theme";
import { WINDOW_TITLE } from "../timeline";

/**
 * The product, as proof, on a still.
 *
 * Both stills carry the same element: a real slice of what the demo shows,
 * inside the same chrome. A launch card that shows only a logo and a tagline
 * asks the reader to take the project on faith; a card that shows the actual
 * output does not.
 *
 * Terminal projects get the first few captured lines, sized down to fit and
 * masked at the right edge so a clipped column reads as a window rather than as
 * a mistake. Screenshot projects get the first shot, top aligned, because the
 * top of a UI is where its identity lives.
 */
export const Proof: FC<{
  width: number;
  height: number;
  /** Terminal mode: how many rows of the transcript to show. */
  rows?: number;
  /** Terminal mode: type ceiling, so a narrow card does not get giant text. */
  maxFont?: number;
  titlebarH?: number;
}> = ({ width, height, rows = 6, maxFont = 17, titlebarH = 40 }) => {
  const demo = content.demo;

  if (demo.kind === "screens") {
    const shot = demo.shots[0];
    return (
      <Window
        title={WINDOW_TITLE}
        width={width}
        height={height}
        titlebarH={titlebarH}
        traffic
        titleSize={15}
      >
        {shot ? (
          <Img
            src={staticFile(shot.src)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              objectPosition: "top center",
              display: "block",
            }}
          />
        ) : null}
      </Window>
    );
  }

  const padX = 22;
  const padY = 16;
  const fontSize = Math.max(
    11,
    Math.min(maxFont, Math.floor((width - padX * 2) / (TERM.cols * 0.6))),
  );
  const lineHeight = Math.round(fontSize * 1.45);

  /**
   * Blank rows are dropped here, unlike in the video. On a still there is no
   * build to pace, so the vertical rhythm of the original output buys nothing
   * and the density is worth more: six real rows say more than three rows and
   * three gaps.
   */
  const body = demo.lines.filter((l) => l.spans.length > 0);

  return (
    <Window
      title={WINDOW_TITLE}
      width={width}
      height={height}
      titlebarH={titlebarH}
      traffic
      titleSize={15}
      bodyStyle={{ padding: `${padY}px ${padX}px`, overflow: "hidden" }}
    >
      <div
        style={{
          maskImage: "linear-gradient(to right, #000 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, #000 92%, transparent 100%)",
        }}
      >
        <div
          style={{
            ...mono,
            fontSize,
            lineHeight: `${lineHeight}px`,
            color: ansi.fg,
          }}
        >
          <span style={{ color: claude.clay, fontWeight: 700 }}>{"> "}</span>
          {demo.command}
        </div>
        <div style={{ height: lineHeight / 2 }} />
        {body.slice(0, rows).map((line, i) => (
          <div
            key={i}
            style={{
              ...mono,
              fontSize,
              lineHeight: `${lineHeight}px`,
              height: lineHeight,
              color: ansi.fg,
            }}
          >
            <SpanRun spans={line.spans} size={fontSize} />
          </div>
        ))}
      </div>
    </Window>
  );
};
