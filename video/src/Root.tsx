import type { FC } from "react";
import { Composition, Still } from "remotion";

import { Demo } from "./Demo";
import { Banner } from "./scenes/Banner";
import { SocialCard } from "./scenes/SocialCard";
import { FPS, FRAME_H, FRAME_W } from "./theme";
import { DEMO_DURATION } from "./timeline";

// side effect: blocks the render until JetBrains Mono is actually loaded
import "./font";

/**
 * The three compositions, and their sizes, which never change:
 *
 *   Demo   1920x1080, 30fps  -> demo.mp4 and demo.gif
 *   Social 1280x640          -> social-card.png (GitHub social preview)
 *   Banner 1584x396          -> banner.png (README hero, LinkedIn 4:1)
 *
 * The duration is derived from the content, so it changes per project. The
 * dimensions do not: they are what every downstream surface expects.
 */
export const RemotionRoot: FC = () => {
  return (
    <>
      <Composition
        id="Demo"
        component={Demo}
        durationInFrames={DEMO_DURATION}
        fps={FPS}
        width={FRAME_W}
        height={FRAME_H}
      />
      <Still id="Social" component={SocialCard} width={1280} height={640} />
      <Still id="Banner" component={Banner} width={1584} height={396} />
    </>
  );
};
