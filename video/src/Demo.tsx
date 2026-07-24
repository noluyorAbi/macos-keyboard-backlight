import type { FC } from "react";
import { AbsoluteFill, Sequence } from "remotion";

import { withAlpha } from "./color";
import { ColdOpen } from "./scenes/ColdOpen";
import { EndCard } from "./scenes/EndCard";
import { ScreensScene } from "./scenes/ScreensScene";
import { TerminalScene } from "./scenes/TerminalScene";
import { accent, claude } from "./theme";
import {
  BODY_AT,
  BODY_DURATION,
  COLD_OPEN_DUR,
  END_CARD_AT,
  END_CARD_DUR,
  TERMINAL,
} from "./timeline";

/**
 * Scene layout, 30fps.
 *
 * The scenes overlap by design: each one fades itself in and out, so the cuts
 * are cross dissolves against a background that never moves. There is no hard
 * cut and nothing slides across the frame.
 *
 * The body is either the terminal demo or the screenshot walkthrough, decided
 * by `content.demo.kind`. Everything around it (the background, the cold open,
 * the end card) is identical either way, which is what keeps a CLI launch and a
 * web launch recognisably the same video.
 */
export const Demo: FC = () => (
  <AbsoluteFill style={{ background: claude.frame }}>
    {/* one static, very low contrast wash so the window has something to sit on */}
    <AbsoluteFill
      style={{
        background: `radial-gradient(1200px 700px at 50% 45%, ${withAlpha(accent, 0.055)}, ${withAlpha(accent, 0)} 70%)`,
      }}
    />

    <Sequence durationInFrames={COLD_OPEN_DUR}>
      <ColdOpen />
    </Sequence>

    <Sequence from={BODY_AT} durationInFrames={BODY_DURATION}>
      {TERMINAL ? <TerminalScene /> : <ScreensScene />}
    </Sequence>

    <Sequence from={END_CARD_AT} durationInFrames={END_CARD_DUR}>
      <EndCard />
    </Sequence>
  </AbsoluteFill>
);
