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

  return `  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}">
  <meta name="theme-color" content="${esc(site.themeColor || "#0b0b0b")}">
  <link rel="canonical" href="${esc(base)}">

  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${esc(req(c.project?.name, "project.name"))}">
  <meta property="og:title" content="${esc(title)}">
  <meta property="og:description" content="${esc(description)}">
  <meta property="og:url" content="${esc(base)}">
  <meta property="og:image" content="${esc(image)}">
  <meta property="og:image:alt" content="${esc(site.ogImageAlt || title)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">

  <meta name="twitter:card" content="summary_large_image">
${twitter.join("\n")}${twitter.length ? "\n" : ""}  <meta name="twitter:title" content="${esc(title)}">
  <meta name="twitter:description" content="${esc(description)}">
  <meta name="twitter:image" content="${esc(image)}">
  <meta name="twitter:image:alt" content="${esc(site.ogImageAlt || title)}">`;
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

  return `      <p class="wordmark">${esc(req(c.project?.wordmark, "project.wordmark"))}</p>
${eyebrow}      <h1 class="hero-title" id="hero-heading">${esc(req(hero.headline, "hero.headline"))}</h1>
      <p class="hero-sub">${esc(req(hero.sub, "hero.sub"))}</p>

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
    ? `\n          <p class="caption">${esc(demo.caption)}</p>`
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
          <p class="demo-alt">${esc(demo.alt)}</p>${caption}
        </figcaption>
      </figure>`;
}

function whyRegion(c) {
  const why = req(c.why, "why");
  const paragraphs = req(why.body, "why.body")
    .map((p) => `      <p class="prose">${esc(p)}</p>`)
    .join("\n");
  const highlight = why.highlight
    ? `\n      <p class="highlight">${esc(why.highlight)}</p>`
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
          <p class="card-body">${esc(req(item.body, "features.items[].body"))}</p>
        </li>`,
    )
    .join("\n");

  return `      <h2 class="section-title" id="features-heading">${icon(features.icon || "zap", "icon section-icon")}<span>${esc(req(features.heading, "features.heading"))}</span></h2>
      <ul class="grid">
${items}
      </ul>`;
}

function installRegion(c) {
  const install = req(c.install, "install");
  const intro = install.intro
    ? `\n      <p class="prose">${esc(install.intro)}</p>`
    : "";
  const note = install.note
    ? `\n      <p class="note">${esc(install.note)}</p>`
    : "";
  const steps = req(install.steps, "install.steps")
    .map(
      (step, i) => `        <li class="step">
          <h3 class="step-title">${esc(req(step.title, "install.steps[].title"))}</h3>
          <p class="step-body">${esc(req(step.body, "install.steps[].body"))}</p>
          ${copyBlock(req(step.command, "install.steps[].command"), `install-step-${i + 1}`)}
        </li>`,
    )
    .join("\n");

  return `      <h2 class="section-title" id="install-heading">${icon(install.icon || "download", "icon section-icon")}<span>${esc(req(install.heading, "install.heading"))}</span></h2>${intro}
      <ol class="steps">
${steps}
      </ol>${note}`;
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

const REGIONS = {
  head: headRegion,
  hero: heroRegion,
  demo: demoRegion,
  why: whyRegion,
  features: featuresRegion,
  install: installRegion,
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

function robots(content) {
  const base = String(content.site.url).replace(/\/+$/, "");
  return `# Static one page site. Everything here is public.
User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`;
}

function sitemap(content) {
  const base = String(content.site.url).replace(/\/+$/, "");
  const today = new Date().toISOString().slice(0, 10);
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
