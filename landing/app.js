/* ==========================================================================
   app.js, the whole client side of this page.

   Vanilla, no dependency, no module loader, no network call. Three jobs:
     1. click to copy on every command block
     2. one UTM helper that every outbound link goes through
     3. play the demo when it is on screen, unless motion is unwelcome

   Loaded with defer, so the DOM is parsed before this runs.
   ========================================================================== */

(function () {
  "use strict";

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ------------------------------------------------------------------ utm */
  /*
    The single place UTM parameters are built. sync.mjs stamps the same
    parameters into the generated HTML at build time using the identical rule,
    so a link is tagged whether or not JavaScript ran. This function is
    idempotent: a link that already carries utm_source is left alone.

    Slot naming: use the section and role, for example hero-primary,
    hero-secondary, footer-repo. The slot becomes utm_medium, so keep the
    vocabulary stable across projects or the analytics stop comparing.
  */
  function withUtm(href, slot, options) {
    var cfg = options || {};
    if (cfg.enabled === false) return href;
    if (!/^https?:\/\//i.test(href)) return href;
    try {
      var url = new URL(href, window.location.href);
      if (url.host === window.location.host) return href;
      if (url.searchParams.has("utm_source")) return url.toString();
      url.searchParams.set("utm_source", cfg.source || "landing");
      url.searchParams.set("utm_medium", slot || "link");
      if (cfg.campaign) url.searchParams.set("utm_campaign", cfg.campaign);
      return url.toString();
    } catch (error) {
      return href;
    }
  }

  function tagOutboundLinks() {
    var links = document.querySelectorAll("a[data-utm-slot]");
    for (var i = 0; i < links.length; i += 1) {
      var el = links[i];
      el.href = withUtm(el.href, el.getAttribute("data-utm-slot"), {
        source: "landing",
      });
    }
  }

  /* ---------------------------------------------------------------- toast */
  var toastTimer = null;

  function toast(message) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message;
    el.setAttribute("data-visible", "true");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      el.removeAttribute("data-visible");
    }, 1800);
  }

  /* ----------------------------------------------------------------- copy */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) {
      /* The async clipboard can still reject: no permission, no user gesture,
         a locked down enterprise policy. Fall through rather than give up. */
      return navigator.clipboard.writeText(text).catch(function () {
        return legacyCopy(text);
      });
    }
    return legacyCopy(text);
  }

  /* file:// and plain http have no async clipboard, and the path above can
     fail even where it exists. A throwaway textarea still works everywhere. */
  function legacyCopy(text) {
    return new Promise(function (resolve, reject) {
      var area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.top = "-1000px";
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try {
        ok = document.execCommand("copy");
      } catch (error) {
        ok = false;
      }
      document.body.removeChild(area);
      if (ok) resolve();
      else reject(new Error("copy rejected"));
    });
  }

  function wireCopyButtons() {
    var buttons = document.querySelectorAll("[data-copy-target]");
    for (var i = 0; i < buttons.length; i += 1) {
      buttons[i].addEventListener("click", function (event) {
        var button = event.currentTarget;
        var source = document.getElementById(
          button.getAttribute("data-copy-target"),
        );
        if (!source) return;
        var label = button.querySelector(".copy-btn-label");
        copyText(source.textContent.trim()).then(
          function () {
            button.setAttribute("data-copied", "true");
            if (label) label.textContent = "Copied";
            toast("Copied to clipboard");
            window.setTimeout(function () {
              button.removeAttribute("data-copied");
              if (label) label.textContent = "Copy";
            }, 1800);
          },
          function () {
            toast("Copy failed, select the command by hand");
          },
        );
      });
    }
  }

  /* ----------------------------------------------------------------- demo */
  function wireDemo() {
    var video = document.querySelector(".demo-video");
    if (!video) return;

    /* With controls present the visitor can always drive it. Autoplay is a
       convenience only, so it is skipped entirely when motion is unwelcome or
       when IntersectionObserver is unavailable. */
    if (REDUCED || typeof IntersectionObserver === "undefined") return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            var attempt = video.play();
            if (attempt && typeof attempt.catch === "function") {
              attempt.catch(function () {
                /* Autoplay blocked by the browser. The poster and the controls
                   are still there, which is the whole fallback. */
              });
            }
          } else if (!video.paused) {
            video.pause();
          }
        });
      },
      { threshold: 0.35 },
    );

    observer.observe(video);
  }

  /* --------------------------------------------------------------- reveal */
  /*
    Content rises the last few pixels into place as it scrolls into view.

    The class is added here rather than sitting in the markup, and that is the
    point: `.reveal` starts at zero opacity, so a page that shipped it
    statically would be blank for anyone without JavaScript. Adding it at
    runtime means the no-script fallback is simply the finished layout.

    Groups stagger. The delay goes through the CSSOM, not a style attribute,
    because the page's Content-Security-Policy allows no inline style.
  */
  var REVEAL_GROUPS = [
    ".hero > *",
    ".section-title",
    ".mb-stage",
    ".demo",
    ".prose",
    ".highlight",
    ".card",
    ".step",
    ".sun-preview",
    ".faq",
    ".section-sun .copy",
  ];

  var STAGGER_MS = 60;
  var MAX_STAGGER = 5; /* past a handful the last item feels late, not staged */

  function wireReveal() {
    if (REDUCED || typeof IntersectionObserver === "undefined") return;

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target); /* once, not on every pass */
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -8% 0px" },
    );

    REVEAL_GROUPS.forEach(function (selector) {
      var items = document.querySelectorAll(selector);
      for (var i = 0; i < items.length; i += 1) {
        var el = items[i];
        el.classList.add("reveal");
        if (i > 0) {
          el.style.setProperty(
            "--reveal-delay",
            Math.min(i, MAX_STAGGER) * STAGGER_MS + "ms",
          );
        }
        observer.observe(el);
      }
    });
  }

  /* -------------------------------------------------------------- localnav */
  /*
    Underline the section being read, the way a product page local nav does.
    Anything the observer reports as intersecting counts; the last one to enter
    from the top wins, which is what makes scrolling up select the section you
    are scrolling into rather than the one you are leaving.
  */
  function wireLocalnav() {
    var links = document.querySelectorAll(".localnav-link[href^='#']");
    if (!links.length || typeof IntersectionObserver === "undefined") return;

    var byId = {};
    var targets = [];
    for (var i = 0; i < links.length; i += 1) {
      var id = links[i].getAttribute("href").slice(1);
      var section = document.getElementById(id);
      if (!section) continue;
      byId[id] = links[i];
      targets.push(section);
    }
    if (!targets.length) return;

    var visible = {};

    function paint() {
      var current = null;
      for (var i = 0; i < targets.length; i += 1) {
        if (visible[targets[i].id]) {
          current = targets[i].id;
          break;
        }
      }
      for (var id in byId) {
        if (id === current) byId[id].setAttribute("aria-current", "true");
        else byId[id].removeAttribute("aria-current");
      }
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          visible[entry.target.id] = entry.isIntersecting;
        });
        paint();
      },
      /* Ignore the strip under the bar itself, and treat the top half of the
         viewport as "what is being read". */
      { rootMargin: "-52px 0px -55% 0px" },
    );

    targets.forEach(function (section) {
      observer.observe(section);
    });
  }

  tagOutboundLinks();
  wireCopyButtons();
  wireDemo();
  wireReveal();
  wireLocalnav();

  /* Exposed so a project can add a link later and tag it the same way. */
  window.launch = { withUtm: withUtm, toast: toast };
})();
