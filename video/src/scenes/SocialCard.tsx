import type { FC } from "react";
import { AbsoluteFill } from "remotion";

import {
  Highlights,
  InstallPill,
  Mark,
  RepoLine,
  Tagline,
} from "../components/Brand";
import { KeyboardProof } from "../components/KeyboardProof";
import { withAlpha } from "../color";
import { content } from "../content";
import { accent, claude } from "../theme";

/**
 * GitHub social preview card, 1280x640 (2:1), rendered as a still to
 * assets/social-card.png.
 *
 * GitHub crops this card to different aspect ratios across surfaces, so every
 * load-bearing element stays inside a centred safe area with generous margins.
 * Same three beats as the banner, stacked instead of side by side: who it is,
 * what it does, and proof that it does it.
 */

const PAD = 56;
const INNER_W = 1280 - PAD * 2;

const markSize = Math.max(
  40,
  Math.min(68, Math.floor(INNER_W / ((content.name.length + 2) * 0.6))),
);

export const SocialCard: FC = () => (
  <AbsoluteFill style={{ background: claude.frame }}>
    <AbsoluteFill
      style={{
        background: `radial-gradient(1100px 620px at 50% 40%, ${withAlpha(accent, 0.1)}, ${withAlpha(accent, 0)} 60%)`,
      }}
    />

    <AbsoluteFill
      style={{
        padding: PAD,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Mark size={markSize} />
        <Tagline size={26} />
        <Highlights size={20} />
      </div>

      <KeyboardProof width={INNER_W} height={268} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <InstallPill size={24} padding="13px 24px" />
        {/* The site, not the repo: this card is what gets unfurled in a chat
            window or a search result, where the reader has not arrived from
            GitHub and the shortest useful address wins. */}
        <RepoLine size={20} site />
      </div>
    </AbsoluteFill>
  </AbsoluteFill>
);
