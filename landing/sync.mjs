#!/usr/bin/env node
/*
 * sync.mjs, the only moving part of this landing page.
 *
 * It reads content.json and rewrites the marked regions of index.html, then
 * regenerates robots.txt and sitemap.xml. Nothing else in the directory is
 * touched, and the result is plain static HTML.
 *
 * Why a generator at all, when the page could just fetch content.json in the
 * browser: social crawlers and search engines do not run JavaScript, and a
 * fetch of a local JSON file is blocked under the file:// protocol. Generating
 * once keeps the deployed page static, crawlable, and openable straight from
 * disk, while still leaving content.json as the single place a human edits.
 *
 * This is NOT a build step. Vercel never runs it. Run it yourself after you
 * edit content.json, then commit the result:
 *
 *   node sync.mjs            rewrite index.html, robots.txt, sitemap.xml
 *   node sync.mjs --check    exit 1 if the files are stale, write nothing
 *
 * Node 18 or newer. No dependencies.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const DIR = dirname(fileURLToPath(import.meta.url));
const CHECK = process.argv.includes("--check");

/* ------------------------------------------------------------------ icons */
/* Single color, stroke based, 20 by 20 box, same visual weight as the README
   icon set in templates/readme/icons. Keep the two sets in step when you add
   an icon here. */
const ICON_ATTRS =
  'viewBox="0 0 20 20" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';

const ICONS = {
  clock: '<circle cx="10" cy="10" r="8"/><polyline points="10 5 10 10 13.4 11.7"/>',
  download:
    '<path d="M17.5 12.5 v3.3 a1.7 1.7 0 0 1-1.7 1.7 H4.2 a1.7 1.7 0 0 1-1.7-1.7 v-3.3"/><polyline points="5.8 8.3 10 12.5 14.2 8.3"/><line x1="10" y1="12.5" x2="10" y2="2.5"/>',
  folder:
    '<path d="M4.2 3.6 H7.3 a1.6 1.6 0 0 1 1.28 .64 l.86 1.15 a1.6 1.6 0 0 0 1.28 .64 H15.8 a1.6 1.6 0 0 1 1.6 1.6 v7.2 a1.6 1.6 0 0 1-1.6 1.6 H4.2 a1.6 1.6 0 0 1-1.6-1.6 V5.2 a1.6 1.6 0 0 1 1.6-1.6 z"/>',
  "git-branch":
    '<line x1="5" y1="2.5" x2="5" y2="12.5"/><circle cx="15" cy="5" r="2.5"/><circle cx="5" cy="15" r="2.5"/><path d="M15 7.5 a7.5 7.5 0 0 1-7.5 7.5"/>',
  shield:
    '<path d="M10 2.2 l6 2.2 v5.1 c0 3.9-2.6 6.5-6 8.3 c-3.4-1.8-6-4.4-6-8.3 V4.4 z"/>',
  terminal:
    '<polyline points="3.3 14.2 8.3 9.2 3.3 4.2"/><line x1="10.4" y1="15.8" x2="16.7" y2="15.8"/>',
  sparkle:
    '<path d="M10 2.2 l1.9 4.6 l4.6 1.9 l-4.6 1.9 l-1.9 4.6 l-1.9-4.6 l-4.6-1.9 l4.6-1.9 z"/><line x1="15.8" y1="14.2" x2="15.8" y2="17.8"/><line x1="14" y1="16" x2="17.6" y2="16"/>',
  book: '<path d="M2.9 4.2 a1.7 1.7 0 0 1 1.7-1.7 H8 a2 2 0 0 1 2 2 v11 a1.7 1.7 0 0 0-1.7-1.7 H4.6 a1.7 1.7 0 0 1-1.7-1.7 z"/><path d="M17.1 4.2 a1.7 1.7 0 0 0-1.7-1.7 H12 a2 2 0 0 0-2 2 v11 a1.7 1.7 0 0 1 1.7-1.7 h3.7 a1.7 1.7 0 0 0 1.7-1.7 z"/>',
  code: '<polyline points="6.2 6.5 2.7 10 6.2 13.5"/><polyline points="13.8 6.5 17.3 10 13.8 13.5"/><line x1="11.4" y1="3.8" x2="8.6" y2="16.2"/>',
  zap: '<path d="M11.2 2.2 L4.5 11 h4.6 l-.3 6.8 L15.5 9 h-4.6 z"/>',
  lock: '<rect x="3.4" y="8.6" width="13.2" height="8.6" rx="1.7"/><path d="M6.5 8.6 V6.2 a3.5 3.5 0 0 1 7 0 v2.4"/>',
  chart:
    '<line x1="2.9" y1="17.1" x2="17.1" y2="17.1"/><line x1="6" y1="17.1" x2="6" y2="10.5"/><line x1="10" y1="17.1" x2="10" y2="5.5"/><line x1="14" y1="17.1" x2="14" y2="8.2"/>',
  sun: '<circle cx="10" cy="10" r="3.6"/><line x1="10" y1="1.8" x2="10" y2="3.4"/><line x1="10" y1="16.6" x2="10" y2="18.2"/><line x1="1.8" y1="10" x2="3.4" y2="10"/><line x1="16.6" y1="10" x2="18.2" y2="10"/><line x1="4.2" y1="4.2" x2="5.3" y2="5.3"/><line x1="14.7" y1="14.7" x2="15.8" y2="15.8"/><line x1="4.2" y1="15.8" x2="5.3" y2="14.7"/><line x1="14.7" y1="5.3" x2="15.8" y2="4.2"/>',
};

function icon(name, cls = "icon") {
  const body = ICONS[name];
  if (!body) {
    throw new Error(
      `content.json asks for the icon "${name}", which does not exist. Available: ${Object.keys(ICONS).join(", ")}`,
    );
  }
  return `<svg class="${cls}" ${ICON_ATTRS} aria-hidden="true" focusable="false">${body}</svg>`;
}

/* ----------------------------------------------------------------- helpers */
const esc = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/*
  Prose, with command flags held together.

  A hyphen is a line break opportunity, so a browser is entitled to end a line
  with "-" and start the next with "-day", and at pull quote size it does. That
  reads as a typo in the copy rather than as wrapping. Flags are the only token
  in this page's prose where a break changes what the text says, so they are the
  only thing wrapped.

  Runs after escaping, which is safe: a flag contains none of the characters
  esc() replaces. Use it for visible prose only, never for an attribute value.
*/
const FLAG_RE = /(^|[\s(])(--?[A-Za-z][\w-]*)/g;

const rich = (value) =>
  esc(value).replace(
    FLAG_RE,
    (_, lead, flag) => `${lead}<span class="nobrk">${flag}</span>`,
  );

function req(value, path) {
  if (value === undefined || value === null || value === "") {
    throw new Error(`content.json is missing a required field: ${path}`);
  }
  return value;
}

function absolute(base, path) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path)) return path;
  return `${String(base).replace(/\/+$/, "")}/${String(path).replace(/^\/+/, "")}`;
}

/* One helper, one shape of outbound link. Every call site goes through this so
   the UTM parameters stay identical everywhere. app.js applies the same rule at
   runtime for links added after load. */
function utm(href, slot, site) {
  const cfg = site.utm || {};
  if (!cfg.enabled) return href;
  if (!/^https?:\/\//i.test(href)) return href;
  try {
    const url = new URL(href);
    if (site.url && url.host === new URL(site.url).host) return href;
    url.searchParams.set("utm_source", cfg.source || "landing");
    url.searchParams.set("utm_medium", slot || "link");
    if (cfg.campaign) url.searchParams.set("utm_campaign", cfg.campaign);
    return url.toString();
  } catch {
    return href;
  }
}

function link(cta, slot, site, className) {
  const href = utm(req(cta.href, `${slot}.href`), cta.slot || slot, site);
  const external = /^https?:\/\//i.test(href);
  const rel = external ? ' rel="noopener"' : "";
  return `<a class="${className}" href="${esc(href)}" data-utm-slot="${esc(cta.slot || slot)}"${rel}>${esc(cta.label)}</a>`;
}

function copyBlock(command, id) {
  return `<div class="copy">
          <pre class="copy-code" id="${esc(id)}"><code>${esc(command)}</code></pre>
          <button class="copy-btn" type="button" data-copy-target="${esc(id)}" aria-label="Copy the command ${esc(command)} to the clipboard">
            <span class="copy-btn-label" aria-hidden="true">Copy</span>
          </button>
        </div>`;
}

/* ----------------------------------------------------------------- regions */
function headRegion(c) {
  const site = c.site || {};
  const base = req(site.url, "site.url");
  const title = req(c.meta?.title, "meta.title");
  const description = req(c.meta?.description, "meta.description");
  const image = absolute(base, site.ogImage || "assets/social-card.png");
  const twitter = [];
  if (site.twitterSite) twitter.push(`  <meta name="twitter:site" content="${esc(site.twitterSite)}">`);
  if (site.twitterCreator)
    twitter.push(`  <meta name="twitter:creator" content="${esc(site.twitterCreator)}">`);

  const imageType = /\.jpe?g$/i.test(image) ? "image/jpeg" : "image/png";

  return `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="${esc(site.themeColor || "#0b0b0b")}">
  <link rel="canonical" href="${esc(base)}">

  <!--
    Stated rather than left to a default. max-image-preview:large is what lets a
    search result carry the social card instead of a thumbnail, and max-snippet
    unbounded is what lets an answer engine quote enough of the page to be
    useful rather than truncating it mid sentence.
  -->
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">

  <!-- The plain text summary written for language models. The same file is
       advertised as a Link header on / by vercel.json. -->
  <link rel="alternate" type="text/markdown" href="${esc(absolute(base, "llms.txt"))}" title="Plain text summary for language models">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(req(c.project?.name, "project.name"))}">
  <meta property="og:locale" content="${esc((site.lang || "en").replace("-", "_") === "en" ? "en_US" : (site.lang || "en").replace("-", "_"))}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(base)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:secure_url" content="${esc(image)}">
  <meta property="og:image:type" content="${imageType}">
  <meta property="og:image:alt" content="${esc(site.ogImageAlt || title)}">
  <meta property="og:image:width" content="1280">
  <meta property="og:image:height" content="640">

  <meta name="twitter:card" content="summary_large_image">
${twitter.join("\n")}${twitter.length ? "\n" : ""}  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <meta name="twitter:image:alt" content="${esc(site.ogImageAlt || title)}">`;
}

/*
  The local navigation bar.

  Modelled on the one Apple puts under the global nav on a product page: the
  product's own name on the left, its sections in the middle, the one action
  worth taking on the right. It is sticky and translucent, so the page keeps
  moving underneath it.

  Every link here is an in-page anchor, which is why none of them go through
  utm(): a UTM parameter on a fragment link tags nothing and would only make
  the address bar ugly. The call to action is an anchor too, because the thing
  it is calling for is a command the visitor copies off this page.
*/
function navRegion(c) {
  const nav = req(c.nav, "nav");
  const cta = req(nav.cta, "nav.cta");
  const links = req(nav.links, "nav.links")
    .map(
      (l) =>
        `          <a class="localnav-link" href="${esc(req(l.href, "nav.links[].href"))}">${esc(req(l.label, "nav.links[].label"))}</a>`,
    )
    .join("\n");

  return `      <a class="localnav-title" href="#top">${esc(req(nav.title, "nav.title"))}</a>
      <nav class="localnav-links" aria-label="Sections of this page">
${links}
      </nav>
      <a class="localnav-cta" href="${esc(req(cta.href, "nav.cta.href"))}">${esc(req(cta.label, "nav.cta.label"))}</a>`;
}

function heroRegion(c) {
  const site = c.site || {};
  const hero = req(c.hero, "hero");
  const install = req(hero.install, "hero.install");
  const eyebrow = hero.eyebrow
    ? `      <p class="eyebrow">${esc(hero.eyebrow)}</p>\n`
    : "";
  const then = install.then
    ? `\n        <p class="install-then">${esc(install.then)}</p>`
    : "";

  /*
    The closed machine. Apple opens the MacBook Pro page on the laptop shut,
    seen head on, with the light escaping through the lid gap, and that shot is
    this product: the light in the gap IS the keyboard backlight. Pure CSS in
    styles.css; the markup is five stacked slabs and carries no text, so it is
    hidden from assistive tech and costs a crawler nothing.
  */
  const closed = `      <div class="mb-closed" aria-hidden="true">
        <div class="mb-closed-bloom"></div>
        <div class="mb-closed-lid"></div>
        <div class="mb-closed-gap"></div>
        <div class="mb-closed-seam"></div>
        <div class="mb-closed-base"></div>
        <div class="mb-closed-cast"></div>
      </div>`;

  return `      <p class="wordmark">${esc(req(c.project?.wordmark, "project.wordmark"))}</p>
${eyebrow}      <h1 class="hero-title" id="hero-heading">${esc(req(hero.headline, "hero.headline"))}</h1>
      <p class="hero-sub">${rich(req(hero.sub, "hero.sub"))}</p>

${closed}

      <div class="install-strip">
        <p class="install-label" id="hero-install-label">${esc(install.label || "Install")}</p>
        ${copyBlock(req(install.command, "hero.install.command"), "hero-install")}${then}
      </div>

      <p class="cta-row">
        ${link(req(hero.primaryCta, "hero.primaryCta"), "hero-primary", site, "btn btn-primary")}
        ${link(req(hero.secondaryCta, "hero.secondaryCta"), "hero-secondary", site, "btn btn-secondary")}
      </p>`;
}

function demoRegion(c) {
  const demo = req(c.demo, "demo");
  const video = req(demo.video, "demo.video");
  const caption = demo.caption
    ? `\n          <p class="caption">${rich(demo.caption)}</p>`
    : "";

  return `      <h2 class="section-title" id="demo-heading">${icon(demo.icon || "terminal", "icon section-icon")}<span>${esc(req(demo.heading, "demo.heading"))}</span></h2>
      <figure class="demo">
        <video
          class="demo-video"
          src="${esc(req(video.src, "demo.video.src"))}"
          poster="${esc(video.poster || "")}"
          width="${esc(video.width || 1920)}"
          height="${esc(video.height || 1080)}"
          controls
          muted
          loop
          playsinline
          preload="none"
          aria-label="${esc(req(demo.alt, "demo.alt"))}">
          <p>Your browser cannot play this video. <a href="${esc(video.src)}">Download the recording</a> instead.</p>
        </video>
        <figcaption class="demo-caption">
          <p class="demo-alt">${rich(demo.alt)}</p>${caption}
        </figcaption>
      </figure>`;
}

function whyRegion(c) {
  const why = req(c.why, "why");
  const paragraphs = req(why.body, "why.body")
    .map((p) => `      <p class="prose">${rich(p)}</p>`)
    .join("\n");
  const highlight = why.highlight
    ? `\n      <p class="highlight">${rich(why.highlight)}</p>`
    : "";

  return `      <h2 class="section-title" id="why-heading">${icon(why.icon || "sparkle", "icon section-icon")}<span>${esc(req(why.heading, "why.heading"))}</span></h2>
${paragraphs}${highlight}`;
}

function featuresRegion(c) {
  const features = req(c.features, "features");
  const items = req(features.items, "features.items")
    .map(
      (item) => `        <li class="card">
          <h3 class="card-title">${icon(item.icon || "zap", "icon card-icon")}<span>${esc(req(item.title, "features.items[].title"))}</span></h3>
          <p class="card-body">${rich(req(item.body, "features.items[].body"))}</p>
        </li>`,
    )
    .join("\n");

  return `      <h2 class="section-title" id="features-heading">${icon(features.icon || "zap", "icon section-icon")}<span>${esc(req(features.heading, "features.heading"))}</span></h2>
      <ul class="grid">
${items}
      </ul>`;
}

/*
  The sun section carries a small day/night preview.

  What is generated here is deliberately a labelled EXAMPLE, not a computed
  "today": this file runs when a human edits content.json, so any real sunrise
  baked in now would be wrong by minutes tomorrow and by hours in six months.
  sun-preview.js replaces the example with the visitor's own day when it runs,
  and relabels it as it does. Without JavaScript the page still shows a coherent
  day that never claims to be today's.

  The bar geometry lives in CSS custom properties rather than a style attribute,
  because the Content-Security-Policy in vercel.json allows no inline styles.
*/
function sunRegion(c) {
  const sun = req(c.sun, "sun");
  const preview = req(sun.preview, "sun.preview");
  const example = req(preview.example, "sun.preview.example");

  const paragraphs = req(sun.body, "sun.body")
    .map((p) => `      <p class="prose">${rich(p)}</p>`)
    .join("\n");
  const highlight = sun.highlight
    ? `\n      <p class="highlight">${rich(sun.highlight)}</p>`
    : "";
  const note = sun.note ? `\n      <p class="note">${rich(sun.note)}</p>` : "";

  const mark = (key, value, hook) =>
    `          <div class="sun-mark">
            <dt class="sun-mark-key">${esc(key)}</dt>
            <dd class="sun-mark-value" ${hook}>${esc(value)}</dd>
          </div>`;

  return `      <h2 class="section-title" id="sun-heading">${icon(sun.icon || "sun", "icon section-icon")}<span>${esc(req(sun.heading, "sun.heading"))}</span></h2>
${paragraphs}

      <figure class="sun-preview" data-sun-preview data-sun-live-label="${esc(req(preview.liveLabel, "sun.preview.liveLabel"))}">
        <p class="sun-preview-label" data-sun-label>${esc(req(preview.label, "sun.preview.label"))}</p>

        <div class="sun-track" aria-hidden="true">
          <div class="sun-lit sun-lit-early"></div>
          <div class="sun-lit sun-lit-late"></div>
          <div class="sun-now"></div>
        </div>
        <p class="sun-legend" aria-hidden="true">midnight<span class="sun-legend-mid">the glow is the backlight, on</span>midnight</p>

        <dl class="sun-marks">
${mark("sunrise", req(example.sunrise, "sun.preview.example.sunrise"), "data-sun-rise")}
${mark("sunset", req(example.sunset, "sun.preview.example.sunset"), "data-sun-set")}
${mark("backlight now", "off, it is daylight", "data-sun-phase")}
        </dl>

        <figcaption class="caption sun-preview-note">${esc(req(preview.note, "sun.preview.note"))}</figcaption>
      </figure>
${highlight}
      ${copyBlock(req(sun.command, "sun.command"), "sun-command")}${note}`;
}

function installRegion(c) {
  const install = req(c.install, "install");
  const intro = install.intro
    ? `\n      <p class="prose">${rich(install.intro)}</p>`
    : "";
  const note = install.note
    ? `\n      <p class="note">${rich(install.note)}</p>`
    : "";
  const steps = req(install.steps, "install.steps")
    .map(
      (step, i) => `        <li class="step">
          <h3 class="step-title">${esc(req(step.title, "install.steps[].title"))}</h3>
          <p class="step-body">${rich(req(step.body, "install.steps[].body"))}</p>
          ${copyBlock(req(step.command, "install.steps[].command"), `install-step-${i + 1}`)}
        </li>`,
    )
    .join("\n");

  return `      <h2 class="section-title" id="install-heading">${icon(install.icon || "download", "icon section-icon")}<span>${esc(req(install.heading, "install.heading"))}</span></h2>${intro}
      <ol class="steps">
${steps}
      </ol>${note}`;
}

/*
  The visible FAQ.

  It exists because the FAQPage block in index.html has to be answerable from the
  page itself: structured data that states an answer the visitor cannot read is
  the definition of the markup search engines penalise, and an answer engine
  quoting it would be quoting something nobody can check. <details> keeps the
  section short while leaving every answer in the DOM, which is what crawlers
  read.
*/
function faqRegion(c) {
  const faq = req(c.faq, "faq");
  const intro = faq.intro ? `\n      <p class="prose">${rich(faq.intro)}</p>` : "";
  const items = req(faq.items, "faq.items")
    .map(
      (item) => `        <details class="faq-item">
          <summary class="faq-q">${esc(req(item.q, "faq.items[].q"))}</summary>
          <p class="faq-a">${rich(req(item.a, "faq.items[].a"))}</p>
        </details>`,
    )
    .join("\n");

  return `      <h2 class="section-title" id="faq-heading">${icon(faq.icon || "book", "icon section-icon")}<span>${esc(req(faq.heading, "faq.heading"))}</span></h2>${intro}
      <div class="faq">
${items}
      </div>`;
}

function footerRegion(c) {
  const site = c.site || {};
  const footer = req(c.footer, "footer");
  const links = (footer.links || [])
    .map((l) => link(l, l.slot || "footer", site, "footer-link"))
    .join("\n        ");
  const commercial = footer.commercial
    ? `<p class="footer-commercial">${esc(footer.commercial.text)}: <a href="mailto:${esc(footer.commercial.email)}">${esc(footer.commercial.email)}</a></p>`
    : "";

  return `      <p class="footer-license">${esc(req(footer.license, "footer.license"))}</p>
      ${commercial}
      <nav class="footer-links" aria-label="Elsewhere">
        ${links}
      </nav>
      <p class="footer-copy">${esc(footer.copyright || "")}</p>`;
}

/* ---------------------------------------------------------------- machine */
/*
  A MacBook, built out of elements and CSS 3D transforms.

  WHY NOT A REAL 3D MODEL
    The Content-Security-Policy in vercel.json sets connect-src to none, so the
    page cannot fetch anything: a glTF loader has nothing to load from. A
    vendored WebGL library would work, but it means shipping several hundred
    kilobytes of renderer onto a page whose entire argument is that the tool it
    describes has one dependency and no build step. Transformed elements cost
    about six kilobytes, need no context, and degrade to a static picture when
    scripting is off, which the canvas cannot do.

  WHY IT IS GENERATED HERE
    So the keyboard exists in the markup. A visitor without JavaScript, and every
    crawler, sees a lit MacBook rather than an empty div waiting for a script.

  The layout is the same data as video/src/keyboard-layout.ts: six rows, fifteen
  key units each, with the real Apple proportions. A board of equal width keys
  reads as a placeholder immediately.
*/
const KEY_ROWS = [
  [
    [1, "esc", 1], [1, "F1", 1], [1, "F2", 1], [1, "F3", 1], [1, "F4", 1],
    [1, "F5", 1], [1, "F6", 1], [1, "F7", 1], [1, "F8", 1], [1, "F9", 1],
    [1, "F10", 1], [1, "F11", 1], [1, "F12", 1], [1, "", 1], [1, "", 1],
  ],
  [
    [1, "~"], [1, "1"], [1, "2"], [1, "3"], [1, "4"], [1, "5"], [1, "6"],
    [1, "7"], [1, "8"], [1, "9"], [1, "0"], [1, "-"], [1, "="], [2, "delete", 1],
  ],
  [
    [1.5, "tab", 1], [1, "Q"], [1, "W"], [1, "E"], [1, "R"], [1, "T"], [1, "Y"],
    [1, "U"], [1, "I"], [1, "O"], [1, "P"], [1, "["], [1, "]"], [1.5, "\\"],
  ],
  [
    [1.75, "caps", 1], [1, "A"], [1, "S"], [1, "D"], [1, "F"], [1, "G"],
    [1, "H"], [1, "J"], [1, "K"], [1, "L"], [1, ";"], [1, "'"], [2.25, "return", 1],
  ],
  [
    [2.25, "shift", 1], [1, "Z"], [1, "X"], [1, "C"], [1, "V"], [1, "B"],
    [1, "N"], [1, "M"], [1, ","], [1, "."], [1, "/"], [2.75, "shift", 1],
  ],
  [
    [1, "fn", 1], [1, "ctrl", 1], [1.25, "opt", 1], [1.25, "cmd", 1],
    [5, ""], [1.25, "cmd", 1], [1.25, "opt", 1],
    [0.75, "◀", 1], [0.75, "▲", 1], [0.75, "▼", 1], [0.75, "▶", 1],
  ],
];

const ROW_UNITS = 15;
for (const [i, row] of KEY_ROWS.entries()) {
  const sum = row.reduce((n, key) => n + key[0], 0);
  if (Math.abs(sum - ROW_UNITS) > 0.001) {
    throw new Error(`keyboard row ${i} is ${sum} units, expected ${ROW_UNITS}`);
  }
}

/* Widths become classes because the CSP allows no style attribute, so a
   flex-grow cannot be written inline. */
const unitClass = (w) => "u" + String(w).replace(".", "-");

function keyboardMarkup() {
  return KEY_ROWS.map((row) => {
    const keys = row
      .map(([w, label, small]) => {
        const cls = ["mb-key", unitClass(w)];
        if (small) cls.push("mb-key-sm");
        if (w === 5) cls.push("mb-key-space");
        return `<span class="${cls.join(" ")}"><span class="mb-key-cap">${esc(label || "")}</span></span>`;
      })
      .join("");
    return `            <div class="mb-row">${keys}</div>`;
  }).join("\n");
}

function machineRegion(c) {
  const machine = req(c.machine, "machine");
  const controls = req(machine.controls, "machine.controls")
    .map((ctl) => {
      const attr = ctl.action
        ? `data-mb-action="${esc(ctl.action)}"`
        : `data-mb-level="${esc(req(ctl.level, "machine.controls[].level"))}"`;
      return `        <button class="mb-btn" type="button" ${attr} aria-label="${esc(req(ctl.command, "machine.controls[].command"))}"><span class="mb-btn-cmd">${esc(ctl.command)}</span></button>`;
    })
    .join("\n");

  return `      <h2 class="section-title" id="machine-heading">${icon(machine.icon || "zap", "icon section-icon")}<span>${esc(req(machine.heading, "machine.heading"))}</span></h2>
      <p class="prose">${rich(req(machine.body, "machine.body"))}</p>

      <div class="mb-stage" data-macbook>
        <div class="mb" data-mb aria-hidden="true">
          <div class="mb-lid">
            <div class="mb-screen">
              <div class="mb-wallpaper"></div>
              <div class="mb-notch"></div>
              <p class="mb-prompt"><span class="mb-prompt-caret">$</span> <span data-mb-echo>kbdlight sun on</span></p>
              <div class="mb-glass"></div>
            </div>
          </div>

          <div class="mb-base">
            <div class="mb-deck">
              <div class="mb-speaker mb-speaker-l"></div>
              <div class="mb-speaker mb-speaker-r"></div>
              <div class="mb-keys">
${keyboardMarkup()}
              </div>
              <div class="mb-trackpad"></div>
              <div class="mb-spill"></div>
            </div>
            <div class="mb-lip"></div>
          </div>

          <div class="mb-cast"></div>
        </div>

        <div class="mb-controls" role="group" aria-label="Run a command on the illustration">
${controls}
        </div>
      </div>

      <p class="caption mb-note">${rich(req(machine.note, "machine.note"))}</p>`;
}

/* --------------------------------------------------------------- sun data */
/*
  The timezone to coordinates table the page uses is the package's own, read
  straight out of ../src/geo.js and written back out as a script the browser can
  load. Copying it by hand would work exactly once: the day someone corrects a
  city in geo.js, the page would quietly keep the old one and start drawing a
  sunrise that the command disagrees with.

  Generated, not fetched: the Content-Security-Policy sets connect-src to none,
  so the page cannot request a JSON file even from its own origin.
*/
function sunData() {
  const require = createRequire(import.meta.url);
  const geo = require("../src/geo.js");

  const compact = (value) => JSON.stringify(value).replace(/","/g, '", "');

  return `/* GENERATED by sync.mjs from ../src/geo.js. Do not edit; run "node sync.mjs". */
window.__kbdlightSunData = {
  zones: ${compact(geo.TZ_COORDS)},
  aliases: ${compact(geo.TZ_ALIASES)}
};
`;
}

const REGIONS = {
  head: headRegion,
  nav: navRegion,
  hero: heroRegion,
  machine: machineRegion,
  demo: demoRegion,
  why: whyRegion,
  features: featuresRegion,
  sun: sunRegion,
  install: installRegion,
  faq: faqRegion,
  footer: footerRegion,
};

/* -------------------------------------------------------------------- main */
function render(html, content) {
  let out = html;
  for (const [name, build] of Object.entries(REGIONS)) {
    const open = `<!-- launch:${name}:start -->`;
    const close = `<!-- launch:${name}:end -->`;
    const start = out.indexOf(open);
    const end = out.indexOf(close);
    if (start === -1 || end === -1 || end < start) {
      throw new Error(`index.html has no ${open} ... ${close} region`);
    }
    /* Keep the closing marker on the indentation its opening marker sits at,
       so the generated file still reads like something a person wrote. */
    const lineStart = out.lastIndexOf("\n", start) + 1;
    const indent = out.slice(lineStart, start).match(/^[ \t]*/)[0];
    const body = `\n${build(content)}\n${indent}`;
    out = out.slice(0, start + open.length) + body + out.slice(end);
  }
  const lang = content.site?.lang || "en";
  return out.replace(/<html lang="[^"]*">/, () => `<html lang="${esc(lang)}">`);
}

// The AI crawlers are named rather than left to the wildcard on purpose. A
// wildcard cannot express a posture, and the posture here is "yes, index and
// cite this": the page exists to be found, and everything on it is already
// public in the repository. Naming them also makes the decision visible, so a
// future change to "search yes, training no" is one line per crawler rather
// than a rewrite.
const AI_CRAWLERS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "Bingbot",
  "CCBot",
  "meta-externalagent",
];

function robots(content) {
  const base = String(content.site.url).replace(/\/+$/, "");
  const named = AI_CRAWLERS.map((ua) => `User-agent: ${ua}\nAllow: /\n${DISALLOW}`).join("\n");
  return `# One page site. Everything here is public except the private launch board.
User-agent: *
Allow: /
${DISALLOW}
# Named explicitly so the posture is stated rather than inferred.
${named}
Sitemap: ${base}/sitemap.xml
`;
}

/**
 * The launch board behind /admin. Answering 404 without ADMIN_PASSWORD set is
 * the real control; this only keeps the path out of indexes for the deployment
 * that does have it set. It is repeated per user-agent because a crawler that
 * matches a named block ignores the wildcard one entirely.
 */
const DISALLOW = "Disallow: /admin\nDisallow: /api/\n";

// lastmod comes from content.json, never from the wall clock. Stamping
// new Date() here would make the generator depend on the day it ran, so
// `sync.mjs --check` (the documented staleness gate) would report the tree
// stale every day after the last sync even when nothing changed, and a plain
// run would produce a spurious sitemap diff every time. Bump site.lastmod when
// the page content actually changes.
function sitemap(content) {
  const base = String(content.site.url).replace(/\/+$/, "");
  const today = content.site.lastmod;
  if (!today || !/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    throw new Error('content.json: site.lastmod is required, format YYYY-MM-DD');
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${base}/</loc>
    <lastmod>${today}</lastmod>
  </url>
</urlset>
`;
}

function main() {
  const content = JSON.parse(readFileSync(join(DIR, "content.json"), "utf8"));
  const outputs = [
    ["index.html", render(readFileSync(join(DIR, "index.html"), "utf8"), content)],
    ["robots.txt", robots(content)],
    ["sitemap.xml", sitemap(content)],
    ["sun-data.js", sunData()],
  ];

  let stale = 0;
  for (const [name, next] of outputs) {
    const path = join(DIR, name);
    let current = "";
    try {
      current = readFileSync(path, "utf8");
    } catch {
      current = "";
    }
    if (current === next) continue;
    stale += 1;
    if (CHECK) {
      console.error(`stale: ${name}`);
      continue;
    }
    writeFileSync(path, next);
    console.log(`wrote: ${name}`);
  }

  if (CHECK && stale > 0) {
    console.error(`${stale} file(s) do not match content.json. Run: node sync.mjs`);
    process.exit(1);
  }
  if (!CHECK && stale === 0) console.log("already in sync");
}

try {
  main();
} catch (error) {
  console.error(`sync.mjs: ${error.message}`);
  process.exit(1);
}
