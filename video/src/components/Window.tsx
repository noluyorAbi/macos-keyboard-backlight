import type { CSSProperties, FC, ReactNode } from "react";

import { MONO } from "../font";
import { ansi, claude, TITLEBAR_H } from "../theme";

const Dot: FC<{ color: string; size?: number }> = ({ color, size = 12 }) => (
  <span
    style={{
      display: "inline-block",
      width: size,
      height: size,
      borderRadius: size / 2,
      background: color,
      flexShrink: 0,
    }}
  />
);

/**
 * The window chrome, shared by every surface: the terminal demo, the screenshot
 * demo, and the mini product shot on both stills. One chrome is the reason two
 * completely different demos still look like the same product.
 *
 * `traffic` picks the dot treatment. The video uses grey dots, because coloured
 * traffic lights next to moving text pull the eye to the corner and away from
 * the content. The stills are read at a glance, so there they earn their colour
 * by saying "this is a real app window" instantly.
 */
export const Window: FC<{
  title: string;
  width: number;
  /** Omit for a window that is exactly as tall as its content. */
  height?: number;
  titlebarH?: number;
  traffic?: boolean;
  titleSize?: number;
  bodyStyle?: CSSProperties;
  children: ReactNode;
}> = ({
  title,
  width,
  height,
  titlebarH = TITLEBAR_H,
  traffic = false,
  titleSize = 19,
  bodyStyle,
  children,
}) => (
  <div
    style={{
      width,
      height,
      borderRadius: 14,
      background: claude.bg,
      border: `1px solid ${claude.border}`,
      boxShadow: "0 40px 90px rgba(0, 0, 0, 0.55)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
    }}
  >
    <div
      style={{
        position: "relative",
        height: titlebarH,
        flexShrink: 0,
        background: claude.panel,
        borderBottom: `1px solid ${claude.border}`,
        display: "flex",
        alignItems: "center",
        paddingLeft: 18,
        paddingRight: 18,
      }}
    >
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <Dot color={traffic ? "#ff5f57" : "#3a3a37"} />
        <Dot color={traffic ? "#febc2e" : "#3a3a37"} />
        <Dot color={traffic ? "#28c840" : "#3a3a37"} />
      </div>

      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: MONO,
          fontSize: titleSize,
          color: ansi.mut,
          fontVariantLigatures: "none",
          fontFeatureSettings: '"liga" 0, "calt" 0',
        }}
      >
        {title}
      </div>
    </div>

    <div style={{ flex: 1, minHeight: 0, position: "relative", ...bodyStyle }}>
      {children}
    </div>
  </div>
);
