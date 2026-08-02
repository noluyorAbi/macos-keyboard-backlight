/* ==========================================================================
   macbook.js, the illustration's behaviour.

   The MacBook itself is markup and CSS transforms; this file does three things
   to it, and nothing else:

     1. lights it to whatever sun mode would be doing on the visitor's machine
        right now, reusing the solar functions sun-preview.js already exposes
     2. lets the buttons run the real commands on it, at the real timings, so
        `kbdlight pulse` blinks the four blinks the tool actually blinks
     3. turns it a few degrees towards the pointer, because a still object at a
        fixed angle reads as a picture of a laptop rather than a laptop

   One number, --mb-glow between 0 and 1, is the entire lighting model. CSS
   derives the keycaps, the bleed, the spill on the aluminium and the wash on
   the screen from it, so everything brightens together.

   Everything degrades: with no script the CSS default leaves the keyboard lit,
   which is the state worth seeing. With reduced motion the tilt and the idle
   drift are dropped and a pulse becomes a single flash rather than four.
   ========================================================================== */

(function () {
  "use strict";

  var stage = document.querySelector("[data-macbook]");
  if (!stage) return;

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var echo = stage.querySelector("[data-mb-echo]");
  var buttons = stage.querySelectorAll(".mb-btn");

  /* The rhythm in src/pulse.js. Kept identical on purpose: this is a
     demonstration of the command, so a prettier timing would be a lie. */
  var PULSE = { count: 4, peak: 1, onMs: 1000, offMs: 500, preDarkMs: 400 };

  var timers = [];
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) window.clearTimeout(timers[i]);
    timers = [];
  }
  function later(fn, ms) {
    timers.push(window.setTimeout(fn, ms));
  }

  function setGlow(level) {
    stage.style.setProperty("--mb-glow", String(level));
  }

  function say(command) {
    if (echo) echo.textContent = command;
  }

  function mark(button) {
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].removeAttribute("data-active");
    }
    if (button) button.setAttribute("data-active", "true");
  }

  /* ------------------------------------------------------------ sun state */

  /*
    What `kbdlight sun on` would be doing here, now. sun-preview.js exposes the
    same solar functions the sun section draws its times with, so the keyboard
    on this page and the bar further down can never disagree with each other.

    Returns null when the timezone is not one we have coordinates for, and the
    caller then leaves the CSS default alone rather than inventing a state.
  */
  function sunLevel() {
    var api = window.__kbdlightSunPreview;
    if (!api || !api.locate || !api.timesFor) return null;

    var where = api.locate();
    if (!where) return null;

    var now = new Date();
    var times = api.timesFor(now, where.lat, where.lon);

    if (times.polar) return times.polar === "day" ? 0 : 0.6;
    var daylight = now >= times.sunrise && now < times.sunset;
    return daylight ? 0 : 0.6;
  }

  function applySun(button) {
    clearTimers();
    var level = sunLevel();
    say("kbdlight sun on");
    mark(button);
    if (level === null) return;
    setGlow(level);
  }

  /* --------------------------------------------------------------- pulse */

  /*
    Four blinks, then back to exactly the level it started from. The restore is
    the point of the real command and so it is the point here too: a demo that
    left the keyboard somewhere else would be demonstrating the wrong thing.
  */
  function pulse(button) {
    clearTimers();
    mark(button);
    say("kbdlight pulse");

    var before = getComputedStyle(stage).getPropertyValue("--mb-glow").trim();
    var restore = parseFloat(before);
    if (!isFinite(restore)) restore = 0.55;

    var blinks = REDUCED ? 1 : PULSE.count;
    var at = 0;

    setGlow(0);
    at += PULSE.preDarkMs;

    for (var i = 0; i < blinks; i++) {
      (function (delay) {
        later(function () {
          setGlow(PULSE.peak);
        }, delay);
        later(function () {
          setGlow(0);
        }, delay + PULSE.onMs);
      })(at);
      at += PULSE.onMs + PULSE.offMs;
    }

    later(function () {
      setGlow(restore);
      mark(null);
    }, at);
  }

  /* ------------------------------------------------------------- controls */

  function run(button) {
    var action = button.getAttribute("data-mb-action");
    var level = button.getAttribute("data-mb-level");

    if (action === "pulse") return pulse(button);
    if (action === "sun") return applySun(button);

    clearTimers();
    setGlow(parseFloat(level));
    say(button.getAttribute("aria-label") || "");
    mark(button);
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function (event) {
      stopCycling();
      run(event.currentTarget);
    });
  }

  /* ----------------------------------------------------------- the demo */

  /*
    Nobody clicks. The five commands are the entire argument this section
    makes, and a visitor who never presses anything sees one still frame of a
    keyboard and scrolls past, so the illustration runs them itself: each
    command in turn, marked on its own button, and the difference between off,
    half, full and a pulse is visible without asking anything of anyone.

    It hands over for good the moment somebody does press a button. Something
    that keeps moving on its own after you have taken hold of it is the whole
    reason carousels are hated.
  */
  var HOLD_MS = 2600;
  var cycleTimer = null;
  var cycleAt = 0;
  /* Reduced motion means what it says: the machine stays where it is, lit for
     the visitor's own hour, and the buttons still work. */
  var cycling = !REDUCED && buttons.length > 0;
  var onScreen = false;

  /* A pulse is not a step you can hold for a fixed beat: it is four blinks at
     the real command's timings, so its slot is as long as it takes plus a
     breath at the end. */
  function stepMs(button) {
    if (button.getAttribute("data-mb-action") !== "pulse") return HOLD_MS;
    var blinks = REDUCED ? 1 : PULSE.count;
    return PULSE.preDarkMs + blinks * (PULSE.onMs + PULSE.offMs) + 700;
  }

  function stopCycling() {
    cycling = false;
    if (cycleTimer !== null) window.clearTimeout(cycleTimer);
    cycleTimer = null;
  }

  function pauseCycling() {
    if (cycleTimer !== null) window.clearTimeout(cycleTimer);
    cycleTimer = null;
  }

  function step() {
    var button = buttons[cycleAt % buttons.length];
    cycleAt += 1;
    run(button);
    cycleTimer = window.setTimeout(step, stepMs(button));
  }

  /* Only while it is being looked at. A timer left running through a scrolled
     past section comes back mid pulse, and a machine caught halfway through a
     blink reads as broken rather than as busy. */
  function resumeCycling() {
    if (!cycling || cycleTimer !== null) return;
    if (!onScreen || document.hidden) return;
    cycleTimer = window.setTimeout(step, 900);
  }

  if (cycling && typeof window.IntersectionObserver === "function") {
    new window.IntersectionObserver(
      function (entries) {
        onScreen = entries[entries.length - 1].isIntersecting;
        if (onScreen) resumeCycling();
        else pauseCycling();
      },
      { threshold: 0.4 },
    ).observe(stage);
  } else if (cycling) {
    onScreen = true;
    resumeCycling();
  }

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) pauseCycling();
    else resumeCycling();
  });

  /* ---------------------------------------------------------------- tilt */

  /*
    A few degrees, not many. Past about eight the illusion breaks: these are
    flat planes with painted-on shading, and turning far enough to see that is
    worse than not turning at all.
  */
  var MAX_YAW = 7;
  var MAX_PITCH = 3;
  /* Must match --mb-rx in styles.css: this is where a pointer leaving the
     stage puts the machine back to. */
  var BASE_PITCH = -20;

  function tilt(event) {
    var box = stage.getBoundingClientRect();
    var x = (event.clientX - box.left) / box.width - 0.5;
    var y = (event.clientY - box.top) / box.height - 0.5;
    stage.style.setProperty("--mb-ry", (x * MAX_YAW * 2).toFixed(2) + "deg");
    stage.style.setProperty(
      "--mb-rx",
      (BASE_PITCH + y * MAX_PITCH * 2).toFixed(2) + "deg",
    );
  }

  function untilt() {
    stage.style.setProperty("--mb-ry", "0deg");
    stage.style.setProperty("--mb-rx", BASE_PITCH + "deg");
  }

  if (!REDUCED && window.matchMedia("(hover: hover)").matches) {
    stage.addEventListener("pointermove", tilt);
    stage.addEventListener("pointerleave", untilt);
  }

  /* Light it for the visitor's own evening, without marking a button: nothing
     has been pressed yet, and the sun state is where it starts from. */
  var initial = sunLevel();
  if (initial !== null) setGlow(initial);
})();
