# video

Remotion source for this project's launch assets. Rendering it produces the four
files the top level README and GitHub use:

| Artifact                    | Size             | Notes                              |
| --------------------------- | ---------------- | ---------------------------------- |
| `../assets/demo.mp4`        | 1920x1080, 30fps | h264, linked from the README       |
| `../assets/demo.gif`        | 960x540, 15fps   | embedded inline in the README      |
| `../assets/banner.png`      | 1584x396         | README hero                        |
| `../assets/social-card.png` | 1280x640         | GitHub social preview              |

Everything the assets say about the project lives in `src/content.ts`. That is
the only file to edit. The contract for it is in `TEMPLATE.md`.

## Prerequisites

Node 22 or 24 LTS. **Do not use Node 26**: Remotion's browser fetcher depends on
`extract-zip`, which breaks there, so Chrome Headless Shell is never extracted
and the render dies quietly with no useful error. An `.nvmrc` pinning 24 is
included.

```sh
nvm use
npm install
npx remotion browser ensure   # downloads Chrome Headless Shell (~94 MB), once
```

`browser ensure` is optional but worth running first: otherwise the download
happens silently in the middle of the first render and looks exactly like a
hang.

## Preview

```sh
npm run dev        # Remotion Studio, scrub the timeline
```

## Render

```sh
npm run build           # all four artifacts
npm run render:mp4      # 1920x1080 h264  -> ../assets/demo.mp4
npm run render:gif      # 960x540 15fps   -> ../assets/demo.gif
npm run render:banner   # 1584x396 png    -> ../assets/banner.png
npm run render:social   # 1280x640 png    -> ../assets/social-card.png
```

All four write **outside** this directory, into `../assets/`. That is
deliberate: `out/` is in `.gitignore`, so anything rendered there could never be
committed, and the whole point of these artifacts is to be committed and
embedded.

To check what you actually produced:

```sh
ffprobe -v error -select_streams v:0 \
  -show_entries stream=width,height,r_frame_rate,nb_frames \
  -of default=nw=1 ../assets/demo.gif
```

## Structure

```
src/
  content.ts           the project: name, tagline, install, demo payload
  content-types.ts     the contract content.ts is checked against
  ansi.ts              real ANSI escape output parsed into spans
  spans.ts             the span model
  color.ts             hex maths, so the accent propagates everywhere
  theme.ts             palette, easing curves, derived terminal metrics
  font.ts              JetBrains Mono, loaded from disk
  timeline.ts          every frame number, derived from content.ts
  Demo.tsx             scene layout and the cross dissolves
  Root.tsx             the three compositions
  components/          Window chrome, terminal primitives, brand lockup, stills proof
  scenes/              ColdOpen, TerminalScene, ScreensScene, EndCard, Banner, SocialCard
public/fonts/          JetBrains Mono woff2 (OFL, licence included)
public/screens/        screenshots, only used by the "screens" demo mode
```

## Things that will bite you if you change this

**Do not put codec options in `remotion.config.ts`.** The config applies to
every render regardless of codec. A `Config.setCrf()` there makes every GIF
render fail with `The "gif" codec does not support the --crf option`. Codec
specific flags belong on the CLI, which is where the package scripts put them.

**Do not switch the font to `@remotion/google-fonts`.** It fetches
fonts.gstatic.com at render time with an 18 second timeout, so the render stops
being offline or deterministic. The woff2 files are committed under
`public/fonts/` and loaded with `@remotion/fonts`.

**Keep the full JetBrains Mono, not a subset.** The fontsource "latin" subset is
missing every non-ASCII glyph a CLI prints (`─ ● ◆ ▁ █ ≈`), which renders
captured output as tofu boxes.

**Never remove the ligature reset.** JetBrains Mono fuses `--` into a single long
dash glyph, so a flag like `--stale` would stop showing the characters the user
actually types. `termText` in `components/Term.tsx` disables `liga` and `calt`.

**Animation must be a pure function of the frame.** Remotion renders frames out
of order and in parallel, so `useState` or `setInterval` driven animation
produces corrupted, nondeterministic output. Everything here derives from
`useCurrentFrame()`.

Tailwind is intentionally absent. `create-video --blank` installs it even when
you pass `--no-tailwind` (the flag is ignored in 4.0.489), so it was stripped.
