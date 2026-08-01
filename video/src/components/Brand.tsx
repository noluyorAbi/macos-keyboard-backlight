import type { FC } from "react";

import { content } from "../content";
import { mono } from "./Term";
import { ansi, claude } from "../theme";

/**
 * The brand lockup and the two things every surface repeats: the one command
 * that installs the project, and where it lives. Kept in one place so the end
 * card, the banner and the social card cannot drift apart.
 *
 * The diamond is the only decoration in the whole system. It carries the accent
 * so the accent has somewhere to live even on a frame with no cursor in it.
 */
export const Mark: FC<{ size: number; letterSpacing?: number }> = ({
  size,
  letterSpacing = -1,
}) => (
  <div
    style={{
      ...mono,
      fontSize: size,
      fontWeight: 700,
      color: claude.bright,
      letterSpacing,
      lineHeight: 1,
    }}
  >
    <span style={{ color: claude.clay }}>◆</span> {content.name}
  </div>
);

/*
 * The tagline carries the landing page's headline treatment: bright white with
 * a soft white bloom, because on this project the glow is the product. The
 * shadow radii scale with the type so the banner and the end card bloom the
 * same amount relative to their letters.
 */
export const Tagline: FC<{ size: number; color?: string }> = ({
  size,
  color = claude.bright,
}) => (
  <div
    style={{
      ...mono,
      fontSize: size,
      color,
      lineHeight: 1.35,
      whiteSpace: "pre-wrap",
      textShadow: `0 0 ${Math.round(size * 0.6)}px rgba(255, 255, 255, 0.34), 0 0 ${Math.round(size * 2.2)}px rgba(223, 231, 245, 0.24)`,
    }}
  >
    {content.tagline}
  </div>
);

/** The copyable command. The `$` is the prompt, not part of what you type. */
export const InstallPill: FC<{ size: number; padding?: string }> = ({
  size,
  padding = "16px 28px",
}) => (
  <div
    style={{
      ...mono,
      fontSize: size,
      color: claude.text,
      background: claude.panel,
      border: `1px solid ${claude.border}`,
      borderRadius: 10,
      padding,
      alignSelf: "flex-start",
    }}
  >
    <span style={{ color: claude.clay }}>$</span> {content.install}
  </div>
);

/**
 * Where to go next. Defaults to the repository; pass `site` on a card whose
 * reader is not already on GitHub, and it prefers the project's own address.
 */
export const RepoLine: FC<{ size: number; site?: boolean }> = ({
  size,
  site = false,
}) => (
  <div style={{ ...mono, fontSize: size, color: ansi.mut }}>
    {(site && content.siteUrl) || content.repoUrl}
  </div>
);

/** Two to four short claims, separated by accented middots. */
export const Highlights: FC<{ size: number }> = ({ size }) => {
  const items = content.highlights ?? [];
  if (items.length === 0) {
    return null;
  }
  return (
    <div
      style={{ ...mono, fontSize: size, color: ansi.mut, letterSpacing: 0.3 }}
    >
      {items.map((item, i) => (
        <span key={item}>
          {i > 0 ? <span style={{ color: claude.clay }}> · </span> : null}
          {item}
        </span>
      ))}
    </div>
  );
};
