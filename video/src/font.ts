/**
 * Deterministic, offline font loading.
 *
 * Do NOT use @remotion/google-fonts here. It builds FontFace objects that point
 * at fonts.gstatic.com and fetches them at render time with an 18 second
 * timeout, so a network hiccup produces a failed or visually inconsistent
 * render. The woff2 files live in public/ and are loaded from disk instead.
 *
 * loadFont() calls delayRender() internally and continueRender() once the
 * FontFace resolves, so this module-scope call is enough to block the render
 * until the font is ready. No manual delayRender() wiring is needed.
 *
 * These are the FULL JetBrains Mono webfonts (1363 codepoints), not the
 * fontsource "latin" subset (229 codepoints). The subset is missing every
 * non-ASCII glyph a CLI prints (box drawing, block elements, the geometric
 * shapes), which would render captured output as a wall of tofu boxes. Keep the
 * full files, and keep them committed.
 */

import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const MONO = "JetBrains Mono";

loadFont({
  family: MONO,
  url: staticFile("fonts/JetBrainsMono-Regular.woff2"),
  weight: "400",
});

loadFont({
  family: MONO,
  url: staticFile("fonts/JetBrainsMono-Bold.woff2"),
  weight: "700",
});
