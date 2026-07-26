import { randomBytes } from "node:crypto";
import { COOKIE_NAME, adminEnabled, readCookie, sessionValid } from "./_lib/auth.js";
import { backendName, readState } from "./_lib/store.js";
import { PANEL_CSS } from "./_lib/panel-css.js";
import { PANEL_JS } from "./_lib/panel-js.js";

/**
 * The private launch board.
 *
 * Not linked from anywhere on the site, disallowed in robots.txt, and absent
 * entirely unless ADMIN_PASSWORD is set. The 404 is deliberate: this repository
 * is public, so this route must not answer at all for anyone who has not opted
 * in, including anyone who forks it.
 *
 * The whole panel, markup, styles and script, is one response. That is not just
 * simpler without a bundler: it means "the panel does not exist" is the truth
 * rather than a page whose assets happen to 404.
 *
 * The site's global Content-Security-Policy forbids inline script and any
 * connect-src, which is correct for a static marketing page and fatal for an
 * application. This route sends its own policy instead: a per-request nonce for
 * the one inline style and the one inline script, and connect-src 'self' for
 * the two fetches the panel makes. Nothing is loosened for the rest of the site.
 */

function page(nonce, title, bodyHtml) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>${title}</title>
<style nonce="${nonce}">${PANEL_CSS}</style>
</head>
<body>
${bodyHtml}
</body>
</html>
`;
}

/** Only the gate. It says as little as possible about what is behind it. */
function loginHtml(nonce) {
  return page(
    nonce,
    "Launch",
    `<main class="lp-root" style="display:flex;align-items:center;justify-content:center;padding:16px">
  <form id="lp-login" class="lp-stack" style="width:100%;max-width:280px;gap:12px">
    <span class="lp-wordmark">LAUNCH</span>
    <input id="lp-password" class="lp-input" type="password" autocomplete="current-password" placeholder="password" autofocus>
    <button type="submit" class="lp-btn is-primary">unlock</button>
    <span id="lp-error" style="font-size:11px;color:var(--lp-danger)"></span>
  </form>
</main>
<script nonce="${nonce}">
(function () {
  var form = document.getElementById("lp-login");
  var field = document.getElementById("lp-password");
  var error = document.getElementById("lp-error");
  var button = form.querySelector("button");
  form.onsubmit = function (event) {
    event.preventDefault();
    if (button.disabled) return;
    button.disabled = true;
    button.textContent = "checking";
    error.textContent = "";
    fetch("/api/admin/session", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ password: field.value }),
    })
      .then(function (response) {
        if (response.ok) {
          location.reload();
          return null;
        }
        return response.json().catch(function () {
          return {};
        });
      })
      .then(function (body) {
        if (!body) return;
        error.textContent = body.error || "no";
        button.disabled = false;
        button.textContent = "unlock";
      })
      .catch(function () {
        error.textContent = "network";
        button.disabled = false;
        button.textContent = "unlock";
      });
  };
})();
</script>`,
  );
}

function boardHtml(nonce, state, backend) {
  // </script> inside the payload would end the block early. This is the one
  // escape that matters when embedding JSON in HTML.
  const payload = JSON.stringify(state).replace(/</g, "\\u003c");
  return page(
    nonce,
    "Launch",
    `<div id="lp-app" class="lp-root"></div>
<script type="application/json" id="lp-initial" data-backend="${backend}">${payload}</script>
<script nonce="${nonce}">${PANEL_JS}</script>`,
  );
}

export default async function handler(request, response) {
  if (!adminEnabled()) {
    response.status(404).end();
    return;
  }

  const nonce = randomBytes(16).toString("base64");

  response.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      // style-src-attr is separate on purpose. A nonce cannot be attached to a
      // style attribute, so a nonce-only style-src blocks every style="..." in
      // the markup and every setAttribute("style", ...) in the panel, which
      // leaves the operator with a working but unlaid-out page. Scripts stay
      // nonce-locked; only attribute styling is allowed inline.
      "style-src-attr 'unsafe-inline'",
      "img-src 'self' data:",
      "connect-src 'self'",
      "form-action 'none'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "object-src 'none'",
    ].join("; "),
  );
  response.setHeader("Content-Type", "text/html; charset=utf-8");
  // A private board must not sit in a shared cache, and must not be indexed
  // even if someone links it.
  response.setHeader("Cache-Control", "no-store, max-age=0");
  response.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");

  if (!sessionValid(readCookie(request, COOKIE_NAME))) {
    response.status(200).send(loginHtml(nonce));
    return;
  }

  response.status(200).send(boardHtml(nonce, await readState(), backendName()));
}
