/**
 * The panel's own styling, copied verbatim from the launch-board skill.
 *
 * Kept as a string rather than a .css file because this site has no bundler:
 * the panel is one function-rendered page, so its styles are inlined into that
 * response. Everything is scoped under .lp-root and nothing here reads the
 * landing page's own tokens, so the two cannot fight.
 */

export const PANEL_CSS = String.raw`
/*
 * The panel's own styling.
 *
 * Deliberately not Tailwind and deliberately not the host app's design tokens.
 * This drops into any Next.js app, including one with no CSS framework and one
 * whose own theme would fight it, so every value it needs is declared here and
 * every selector is scoped under .lp-root.
 *
 * Dark only, on purpose. This is a private operator tool, not a product
 * surface, and a single committed look is worth more than theme switching.
 *
 * Contrast is measured against --lp-bg: --lp-fg 15.8:1, --lp-mute 7.9:1,
 * --lp-dim 5.4:1, --lp-edge 3.1:1 for anything bounding a control.
 */

.lp-root {
  --lp-bg: #0a0b0d;
  --lp-panel: #111316;
  --lp-fg: #e8e9ea;
  --lp-mute: #a2a7ad;
  --lp-dim: #7e858c;
  --lp-line: #23262b;
  --lp-edge: #565c63;
  --lp-accent: #7dd3fc;
  --lp-accent-ink: #06202c;
  --lp-danger: #fca5a5;
  --lp-radius: 4px;
  --lp-mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;

  min-height: 100dvh;
  background: var(--lp-bg);
  color: var(--lp-fg);
  font-family: var(--lp-mono);
  font-size: 13px;
  line-height: 1.5;
  /* A faint field so a flat dark page does not read as an unpainted canvas. */
  background-image: radial-gradient(circle at 1px 1px, rgba(255, 255, 255, 0.05) 1px, transparent 0);
  background-size: 22px 22px;
}

.lp-root *,
.lp-root *::before,
.lp-root *::after {
  box-sizing: border-box;
}

.lp-root :where(a, button, input, textarea):focus-visible {
  outline: 2px solid var(--lp-accent);
  outline-offset: 2px;
  border-radius: var(--lp-radius);
}

/* ---------------------------------------------------------------- shell */

.lp-bar {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--lp-line);
  background: color-mix(in srgb, var(--lp-bg) 92%, transparent);
  backdrop-filter: blur(8px);
}

.lp-wordmark {
  font-weight: 700;
  letter-spacing: 0.2em;
  font-size: 12px;
}

.lp-main {
  max-width: 1040px;
  margin: 0 auto;
  padding: 24px 16px;
}

.lp-tabs {
  display: flex;
  gap: 4px;
}

.lp-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ---------------------------------------------------------------- atoms */

.lp-label {
  font-size: 10px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--lp-dim);
}

.lp-meta {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--lp-dim);
}

.lp-num {
  font-variant-numeric: tabular-nums;
}

.lp-btn {
  border: 1px solid var(--lp-line);
  background: transparent;
  color: var(--lp-mute);
  border-radius: var(--lp-radius);
  padding: 6px 10px;
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  transition: color 150ms cubic-bezier(0.25, 1, 0.5, 1), border-color 150ms cubic-bezier(0.25, 1, 0.5, 1);
}

.lp-btn:hover {
  color: var(--lp-fg);
  border-color: var(--lp-edge);
}

.lp-btn.is-on {
  background: var(--lp-accent);
  border-color: var(--lp-accent);
  color: var(--lp-accent-ink);
}

.lp-btn.is-bare {
  border-color: transparent;
}

.lp-btn.is-primary {
  background: var(--lp-accent);
  border-color: var(--lp-accent);
  color: var(--lp-accent-ink);
  font-weight: 500;
  padding: 8px 12px;
  font-size: 12px;
}

.lp-btn.is-primary:disabled {
  opacity: 0.5;
  cursor: default;
}

.lp-btn.is-danger:hover {
  color: var(--lp-danger);
}

.lp-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.lp-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.lp-input,
.lp-area {
  width: 100%;
  border: 1px solid var(--lp-line);
  background: var(--lp-panel);
  color: var(--lp-fg);
  border-radius: var(--lp-radius);
  padding: 8px 12px;
  font: inherit;
  transition: border-color 150ms cubic-bezier(0.25, 1, 0.5, 1);
}

.lp-input:focus,
.lp-area:focus {
  border-color: var(--lp-edge);
  outline: none;
}

.lp-area {
  resize: none;
  line-height: 1.6;
}

.lp-grid {
  display: grid;
  gap: 12px;
}

@media (min-width: 640px) {
  .lp-grid.is-two {
    grid-template-columns: 1fr 1fr;
  }
}

.lp-stack {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.lp-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

/* ---------------------------------------------------------------- list */

.lp-list {
  border: 1px solid var(--lp-line);
  border-radius: var(--lp-radius);
  overflow: hidden;
  list-style: none;
  margin: 0;
  padding: 0;
}

.lp-item + .lp-item {
  border-top: 1px solid var(--lp-line);
}

.lp-item {
  background: var(--lp-panel);
}

.lp-item-head {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 10px 12px;
  background: none;
  border: 0;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background 150ms cubic-bezier(0.25, 1, 0.5, 1);
}

.lp-item-head:hover {
  background: var(--lp-bg);
}

.lp-item-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px 12px;
  border-top: 1px solid var(--lp-line);
}

.lp-empty {
  background: var(--lp-panel);
  padding: 24px 12px;
  text-align: center;
  color: var(--lp-dim);
  font-size: 12px;
}

.lp-note {
  border: 1px solid var(--lp-line);
  background: var(--lp-bg);
  border-radius: var(--lp-radius);
  padding: 8px 12px;
}

.lp-note p {
  margin: 4px 0 0;
  white-space: pre-wrap;
  font-size: 12px;
  color: var(--lp-mute);
}

/* Status is monochrome apart from "posted", which is the one state worth an
   accent: it is the only irreversible one on the board. */
.lp-dot {
  font-size: 11px;
  color: var(--lp-dim);
}
.lp-dot.is-posted {
  color: var(--lp-accent);
}
.lp-dot.is-skipped {
  color: var(--lp-line);
}

.lp-done {
  color: var(--lp-dim);
  text-decoration: line-through;
}

/* ---------------------------------------------------------------- table */

.lp-table {
  width: 100%;
  border-collapse: collapse;
  border: 1px solid var(--lp-line);
  border-radius: var(--lp-radius);
  overflow: hidden;
}

.lp-table th {
  text-align: left;
  padding: 8px;
  background: var(--lp-panel);
  font-weight: 500;
}

.lp-table td {
  padding: 0;
  background: var(--lp-panel);
  border-top: 1px solid var(--lp-line);
}

.lp-cell {
  width: 100%;
  border: 0;
  background: transparent;
  color: var(--lp-fg);
  font: inherit;
  font-size: 12px;
  padding: 8px;
}

.lp-cell:focus {
  outline: none;
  color: var(--lp-accent);
}

.lp-cell.is-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  max-width: 90px;
}

/* Wide content scrolls inside its own box; the page never scrolls sideways. */
.lp-scroll {
  overflow-x: auto;
}

@media (prefers-reduced-motion: reduce) {
  .lp-root *,
  .lp-root *::before,
  .lp-root *::after {
    transition-duration: 0.01ms !important;
  }
}
`;
