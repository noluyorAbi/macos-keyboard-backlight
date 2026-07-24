# Landing page template

A one page marketing site for any project. Static HTML, CSS and a little vanilla
JavaScript. No framework, no bundler, no npm dependency, no build step, and not
one request to a third party host.

Deploying it is pointing Vercel at this directory. Nothing else.

```
vercel deploy --prod          # from inside this directory
```

Or, in the Vercel dashboard: New Project, import the repository, set the root
directory to wherever this folder lives, framework preset "Other", leave the
build command empty. `vercel.json` supplies the rest.

## The one file you edit

`content.json` holds every word, link, and asset path on the page. Everything
else in this directory is generic and is reused unchanged from project to
project.

After editing `content.json`, run the generator:

```
node sync.mjs            # rewrite index.html, robots.txt, sitemap.xml
node sync.mjs --check    # exit 1 if they are stale, write nothing (use in CI)
```

`sync.mjs` needs Node 18 or newer and has no dependencies. It is not a build
step: Vercel never runs it, and the committed `index.html` is the deployed
artifact. It exists because social crawlers and search engines do not execute
JavaScript, so the `og:` tags and the copy have to be in the HTML that ships.
A page that fetched `content.json` in the browser would also be blank when
opened over `file://`.

## Files

| File | What it is | Edit it? |
|------|------------|----------|
| `content.json` | Every string, link and asset path on the page | Yes, this is the file |
| `index.html` | Generated page. Markers `<!-- launch:NAME:start -->` bound the generated regions | Only the structure outside the markers |
| `styles.css` | All styling, design tokens in `:root` | Rarely |
| `app.js` | Copy buttons, the UTM helper, demo playback | Rarely |
| `sync.mjs` | The generator | No |
| `vercel.json` | Caching, security headers, clean URLs | If your asset layout changes |
| `robots.txt` | Generated from `site.url` | No |
| `sitemap.xml` | Generated from `site.url` | No |
| `preview.sh` | `python3 -m http.server` on port 4321 | No |
| `assets/` | `demo.mp4`, `demo.gif`, `social-card.png`, `favicon.svg` | Drop files in |
| `fonts/` | Optional self hosted JetBrains Mono woff2 | Drop files in |

## content.json, field by field

Required fields are marked. A missing required field makes `sync.mjs` exit 1
with the exact path it wanted, rather than shipping a page with a hole in it.

### `site`

| Field | Required | Meaning |
|-------|----------|---------|
| `site.url` | yes | Absolute canonical origin, no trailing slash. Used for the canonical link, `og:url`, the absolute `og:image`, `robots.txt` and `sitemap.xml`. |
| `site.lang` | no | BCP 47 language tag written into `<html lang>`. Defaults to `en`. |
| `site.themeColor` | no | Browser UI color. Defaults to `#0b0b0b`, the shared background token. |
| `site.ogImage` | no | Path or absolute URL of the social card. Defaults to `assets/social-card.png`. Relative paths are resolved against `site.url`, because crawlers reject relative `og:image`. |
| `site.ogImageAlt` | no | Alt text for the social card. Defaults to `meta.title`. |
| `site.twitterSite` | no | The `@handle` of the project account. Omitted from the markup when empty. |
| `site.twitterCreator` | no | The `@handle` of the author. Omitted when empty. |
| `site.utm.enabled` | no | Turns UTM tagging on or off for the whole page. Defaults to on. |
| `site.utm.source` | no | Becomes `utm_source`. Defaults to `landing`. Keep it `landing` unless you run more than one site. |
| `site.utm.campaign` | no | Becomes `utm_campaign` when set. Useful for a launch week. |

### `meta`

| Field | Required | Meaning |
|-------|----------|---------|
| `meta.title` | yes | `<title>`, `og:title`, `twitter:title`. Aim for 60 characters or fewer. |
| `meta.description` | yes | Meta description and both social descriptions. Aim for 155 characters or fewer. |

### `project`

| Field | Required | Meaning |
|-------|----------|---------|
| `project.name` | yes | Canonical project name, used for `og:site_name`. |
| `project.wordmark` | yes | The small mark at the top of the page. Usually the same as `project.name`. |
| `project.repo` | no | Repository URL. Not rendered directly; keep it here so the skill has one obvious place to read it from. |

### `hero`

| Field | Required | Meaning |
|-------|----------|---------|
| `hero.eyebrow` | no | Small pill above the headline. Three or four words. |
| `hero.headline` | yes | The `h1`. One sentence, under about 60 characters. |
| `hero.sub` | yes | One or two sentences under the headline. |
| `hero.install.label` | no | Label above the command. Defaults to `Install`. |
| `hero.install.command` | yes | The primary install command, rendered in a click to copy block. Write it without a leading `$`; the prompt is drawn by CSS. |
| `hero.install.then` | no | A short line under the command, for example how to invoke the thing you just installed. |
| `hero.primaryCta.label` | yes | Text of the filled button. |
| `hero.primaryCta.href` | yes | Destination of the filled button. |
| `hero.primaryCta.slot` | no | UTM slot name. Defaults to `hero-primary`. |
| `hero.secondaryCta.label` | yes | Text of the outlined button. |
| `hero.secondaryCta.href` | yes | Destination of the outlined button. |
| `hero.secondaryCta.slot` | no | UTM slot name. Defaults to `hero-secondary`. |

### `demo`

| Field | Required | Meaning |
|-------|----------|---------|
| `demo.heading` | yes | Section heading. |
| `demo.icon` | no | Icon name for the heading. Defaults to `terminal`. |
| `demo.video.src` | yes | Path to `demo.mp4`, the file the Remotion template renders. |
| `demo.video.poster` | no | Path to `demo.gif`, the downsampled loop, shown before playback. |
| `demo.video.width` | no | Intrinsic width, defaults to 1920. Prevents layout shift. |
| `demo.video.height` | no | Intrinsic height, defaults to 1080. |
| `demo.alt` | yes | What the recording shows, in words. This is the accessible name of the video, so describe the content, not the file. |
| `demo.caption` | no | Small print under the video. |

### `why`

| Field | Required | Meaning |
|-------|----------|---------|
| `why.heading` | yes | Section heading. |
| `why.icon` | no | Icon name. Defaults to `sparkle`. |
| `why.body` | yes | Array of paragraphs. Two is usually right. |
| `why.highlight` | no | One line pulled out with a coral rule beside it. |

### `features`

| Field | Required | Meaning |
|-------|----------|---------|
| `features.heading` | yes | Section heading. |
| `features.icon` | no | Icon name. Defaults to `zap`. |
| `features.items[].icon` | no | Icon name for the card. Defaults to `zap`. |
| `features.items[].title` | yes | Card title, a few words. |
| `features.items[].body` | yes | One or two sentences. |

Three, four or six cards look best; the grid is `auto-fit`, so five leaves a
gap on wide screens.

### `install`

| Field | Required | Meaning |
|-------|----------|---------|
| `install.heading` | yes | Section heading. |
| `install.icon` | no | Icon name. Defaults to `download`. |
| `install.intro` | no | One line before the steps. |
| `install.steps[].title` | yes | Step name, for example `npm` or `curl`. |
| `install.steps[].body` | yes | What this path does and what it costs. |
| `install.steps[].command` | yes | The command, rendered in a click to copy block. |
| `install.note` | no | Small print under the steps, for example how to uninstall. |

### `footer`

| Field | Required | Meaning |
|-------|----------|---------|
| `footer.license` | yes | The license line. For a source available license say so plainly; never call a non OSI license open source. |
| `footer.commercial.text` | no | Label for the commercial licensing contact, for example `Commercial license`. |
| `footer.commercial.email` | no | Address that receives commercial licensing requests. Rendered as a `mailto:` link. |
| `footer.links[].label` | no | Link text. |
| `footer.links[].href` | no | Destination. |
| `footer.links[].slot` | no | UTM slot name. Defaults to `footer`. |
| `footer.copyright` | no | Copyright line. |

### Available icon names

`clock`, `download`, `folder`, `git-branch`, `shield`, `terminal`, `sparkle`,
`book`, `code`, `zap`, `lock`, `chart`.

They are the same set, drawn at the same weight, as the README icons in
`templates/readme/icons`. Asking for a name that does not exist fails the
generator with the list of names that do.

## UTM tagging

Every outbound link goes through one helper, so the parameters cannot drift
between sections. The rule:

```
?utm_source=<site.utm.source, default "landing">&utm_medium=<slot>
```

with `utm_campaign` appended when `site.utm.campaign` is set. Same origin links
and non http links are never tagged, and a link that already carries a
`utm_source` is left alone.

The helper exists twice on purpose, with the same rule in both:

- `utm()` in `sync.mjs` stamps the parameters into the generated HTML, so links
  are tagged even with JavaScript disabled.
- `window.launch.withUtm(href, slot)` in `app.js` tags anything added later, and
  is the function to call if you inject a link at runtime.

Slot names are the section plus the role: `hero-primary`, `hero-secondary`,
`footer-repo`. Keep the vocabulary stable across projects, otherwise the numbers
stop comparing.

## Assets

`assets/` is where the files from the sibling Remotion template land:

| File | Where it comes from | Used by |
|------|---------------------|---------|
| `demo.mp4` | Remotion render | The `<video>` source |
| `demo.gif` | Remotion render, downsampled | The video poster frame |
| `social-card.png` | Remotion still, 1200 by 630 | `og:image` and `twitter:image` |
| `favicon.svg` | Shipped with this template | Browser tab |

The page works with the video missing: the poster frame, the controls and the
download fallback are all still there. It does not look finished, so ship the
recording.

## Fonts

The type is JetBrains Mono with a graceful ladder underneath it:

1. a copy already installed on the visitor's machine, matched by `local()`
2. `fonts/JetBrainsMono-Regular.woff2` and `fonts/JetBrainsMono-Bold.woff2` if
   you put them there
3. the platform monospace stack: `ui-monospace`, `SFMono-Regular`, `SF Mono`,
   `Menlo`, `Consolas`, `Liberation Mono`, `monospace`

Nothing is fetched from Google Fonts or any other host, by design: the strict
Content Security Policy in `vercel.json` allows `font-src 'self'` only, and a
remote font is a remote dependency that can break or track. If you self host,
JetBrains Mono is under the SIL Open Font License 1.1, so ship its `OFL.txt`
next to the woff2 files.

## Accessibility and responsiveness

- Real landmarks: `main`, `footer`, `section` with `aria-labelledby`, `figure`
  with `figcaption`, a real `nav` in the footer, and a skip link.
- Focus is visible everywhere: a two pixel coral outline with an offset.
- Body text sits at 6.2:1 or better against the background. The dimmest token,
  `--dim`, is 4.3:1 and is therefore used for rules and icons only, never for
  running text.
- No horizontal page scroll at any width. Long commands scroll inside their own
  box, and a `.table-scroll` wrapper is provided for tables.
- `prefers-reduced-motion: reduce` removes the transitions, the smooth scroll,
  the hover lift, and the automatic demo playback.
- `prefers-color-scheme: light` gets a full palette, with the coral darkened so
  it still clears 4.5:1 on a light background.
- The page renders without JavaScript. Only copying, the toast, and automatic
  demo playback need it.

## vercel.json

JSON has no comments, so the reasoning lives here.

- `cleanUrls` and `trailingSlash: false` give one canonical URL per page.
- A strict `Content-Security-Policy` is possible precisely because the page is
  self contained: `default-src 'self'`, no inline script or style anywhere,
  `connect-src 'none'`, `frame-ancestors 'none'`. If you add an inline script or
  an embedded third party widget, this header is what will break first, and the
  fix is to move the code into `app.js` rather than to weaken the policy.
- HTML is `max-age=0, must-revalidate`, so a redeploy is visible immediately.
- `styles.css` and `app.js` get ten minutes plus `stale-while-revalidate`, since
  their names are not content hashed.
- `assets/` gets a day plus a week of `stale-while-revalidate`. If you ever
  fingerprint asset filenames, raise it to `max-age=31536000, immutable`.
- `fonts/` is immutable for a year; a woff2 at a given name never changes.
- `Strict-Transport-Security` is set with `preload`. Remove `preload` if this
  domain also serves something that must stay reachable over plain HTTP.

## Local preview

```
sh preview.sh              # http://localhost:4321
PORT=8080 sh preview.sh
```

Opening `index.html` straight from disk works too, since the page is static.
