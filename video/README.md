# video

Remotion source for this project's launch assets. Rendering it produces the four
files the top level README and GitHub use:

| Artifact                       | Size             | Notes                                 |
| ------------------------------ | ---------------- | ------------------------------------- |
| `../assets/demo.mp4`           | 1920x1080, 30fps | h264, linked from the README          |
| `../assets/demo.gif`           | 960x540, 15fps   | embedded inline in the README         |
| `../assets/banner.png`         | 1584x396         | README hero                           |
| `../assets/social-card.png`    | 1280x640         | GitHub social preview, the `og:image` |
| `../landing/assets/poster.jpg` | 1920x1080        | the landing page video poster frame   |

`npm run build` also copies `demo.mp4` and `social-card.png` into
`../landing/assets/`, so the deployed page cannot drift from the committed
assets. Do not copy them by hand.

Most of what the assets say lives in `src/content.ts`. **That is no longer the
only file this project edits**, and the exceptions are listed under "This copy
deviates from the template" at the bottom of this file. Read that before
assuming a change to `content.ts` will show up in the video.

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

One optional native tool:

```sh
brew install gifsicle   # optional, shrinks the GIF from ~3.3 MB to ~1.0 MB
```

`render:gif` pipes the finished GIF through `gifsicle` at 128 colours and
`--lossy=30`. Without it the render still succeeds and the build still exits
zero; it prints a one line notice and ships the unoptimised GIF instead. The
glow gradients in this particular video dither badly, which is why the step
exists at all. 64 colours was tried and rejected: it shreds the glow into bands.

## Preview

```sh
npm run dev        # Remotion Studio, scrub the timeline
```

## Render

```sh
npm run build           # every artifact, then the copy into ../landing/assets/
npm run render:mp4      # 1920x1080 h264  -> ../assets/demo.mp4
npm run render:gif      # 960x540 15fps   -> ../assets/demo.gif  (then gifsicle)
npm run render:banner   # 1584x396 png    -> ../assets/banner.png
npm run render:social   # 1280x640 png    -> ../assets/social-card.png
npm run render:poster   # frame 200 jpeg  -> ../landing/assets/poster.jpg
npm run sync:landing    # copies mp4 + social card into ../landing/assets/
```

They all write **outside** this directory. That is deliberate: `out/` is in
`.gitignore`, so anything rendered there could never be committed, and the whole
point of these artifacts is to be committed and embedded.

`render:poster` pins frame 200, which is the last fully lit frame before the
backlight sweep begins. Move the sweep in `timeline.ts` and that frame number
has to move with it, otherwise the poster shows a half dark keyboard.

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

## This copy deviates from the template

The template's rule is that `src/content.ts` is the only file you edit. This
project breaks it on purpose, once, and this is the record of why.

This tool's visible output is a single number. A terminal demo of `kbdlight get`
shows nothing, and the first cut of the video worked around that by typing
`kbdlight --help` and filming its usage text: it showed the interface and never
showed the product doing anything. What the tool actually changes is the light
under the keys, which no screen capture can record.

So the body scene draws it instead:

| File                               | Why it exists                                                                                            |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `src/keyboard-layout.ts`           | A MacBook keyboard as data, in real key units. Carries a row-width assertion.                            |
| `src/components/Keyboard.tsx`      | The board itself, shared by the video and both stills so there is only ever one keyboard in the project. |
| `src/components/KeyboardProof.tsx` | The lit board fitted to a box, for the banner and the social card.                                       |
| `src/scenes/KeyboardScene.tsx`     | The shot: type a real command, drain the backlight on a diagonal wave.                                   |

### What `content.ts` still does, and what it no longer does

Be precise about this, because the earlier wording here was wrong and cost a
reviewer the time to catch it.

`Demo.tsx` renders `KeyboardScene` unconditionally. **`content.demo` therefore
no longer selects anything.** Editing `demo.kind` or the captured lines in
`content.ts` changes nothing in the video, silently and with no warning. The
`TERMINAL` and `SCREENS` exports in `timeline.ts` are still built at module load
and are still type checked, so a malformed `content.demo` still throws, but the
result is unused.

Everything else in `content.ts` is still authoritative and still drives the
render: `name`, `tagline`, `description`, `install`, `repoUrl`, `accent`,
`highlights`, `coldOpen` and `windowTitle` all feed the cold open, the end card,
the banner and the social card.

These four modules now have no importer at all:

| Module                     | Why it is still here                                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `scenes/TerminalScene.tsx` | The template's terminal demo mode. Restore it by pointing `Demo.tsx` back at it.                                         |
| `scenes/ScreensScene.tsx`  | The template's screenshot demo mode. Same.                                                                               |
| `components/Proof.tsx`     | The template's stills content, replaced here by `KeyboardProof`. Kept so the two scenes above stay restorable as a unit. |
| `components/Window.tsx`    | The window chrome those three share.                                                                                     |

They are retained template surface, not dead code that nobody noticed. If you
decide this project will never go back to a terminal demo, delete all four
together with the `TERMINAL` and `SCREENS` branch in `timeline.ts`; deleting any
one of them alone leaves the others half broken.

The MacBook is an illustration and the project README and the landing caption
both say so. The command it types is real.
