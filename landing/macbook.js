/* ==========================================================================
   macbook.js, the illustration's behaviour.

   The MacBook itself is markup and CSS transforms; this file does four things
   to it, and nothing else:

     1. lights it to whatever sun mode would be doing on the visitor's machine
        right now, reusing the solar functions sun-preview.js already exposes
     2. types each command into the terminal on its screen and runs it there,
        at the real timings, so `kbdlight pulse` blinks the four blinks the
        tool actually blinks and prints nothing, because the tool prints nothing
     3. runs through the commands on its own, hands over the moment anybody
        presses one, and picks the loop back up once they have finished
     4. turns it a few degrees towards the pointer, because a still object at a
        fixed angle reads as a picture of a laptop rather than a laptop

   One number, --mb-glow between 0 and 1, is the entire lighting model. CSS
   derives the keycaps, the bleed, the spill on the aluminium and the wash on
   the screen from it, so everything brightens together.

   Everything degrades: with no script the CSS default leaves the keyboard lit
   and the terminal shows one command already run, which is the state worth
   seeing. With reduced motion the tilt and the idle drift are dropped, a
   command arrives whole instead of a character at a time, and a pulse becomes
   a single flash rather than four.
   ========================================================================== */

(function () {
  "use strict";

  var stage = document.querySelector("[data-macbook]");
  if (!stage) return;

  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var term = stage.querySelector("[data-mb-term]");
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

  /* ------------------------------------------------------------- terminal */

  /*
    The screen runs a terminal, so the commands are typed into it rather than
    swapped out underneath it. A character every 22 to 40 milliseconds is about
    thirty a second, which is a quick typist and not a teleprinter, and the beat
    after the last character is the pause before somebody presses return.

    What the commands print is what the real ones print, which for off, set, max
    and pulse is nothing at all: they succeed quietly and hand the prompt back.
    Inventing a confirmation line for them would be the one lie on a page whose
    whole argument is that this is the tool's own behaviour.
  */
  var TYPE_MS = 22; /* floor per character */
  var TYPE_JITTER = 18; /* and up to this much more, so it is not a metronome */
  var RETURN_MS = 240; /* last character to return */
  var MAX_LINES = 9; /* what fits in the window before the top scrolls off */

  var line = null; /* the live prompt: caret blinking, waiting to be typed at */

  function makeEl(tag, cls, text) {
    var node = document.createElement(tag);
    node.className = cls;
    if (text != null) node.textContent = text;
    return node;
  }

  function trimLines() {
    while (term.children.length > MAX_LINES) term.removeChild(term.firstChild);
  }

  /* A fresh prompt, which is what a shell gives you back when a command ends. */
  function prompt() {
    if (!term) return;
    var row = makeEl("p", "mb-term-line");
    row.appendChild(makeEl("span", "mb-term-path", "~"));
    row.appendChild(makeEl("span", "mb-term-sign", "%"));
    var cmd = makeEl("span", "mb-term-cmd", "");
    row.appendChild(cmd);
    row.appendChild(makeEl("span", "mb-term-caret"));
    term.appendChild(row);
    trimLines();
    line = { row: row, cmd: cmd };
  }

  function print(text) {
    if (!term) return;
    term.appendChild(makeEl("p", "mb-term-out", text));
    trimLines();
  }

  /* Return has been pressed: the cursor leaves the line it was on, and there is
     no live prompt again until the command that line held has finished. */
  function submit(row) {
    var caret = row.querySelector(".mb-term-caret");
    if (caret) row.removeChild(caret);
    row.removeAttribute("data-typing");
    line = null;
  }

  /* How long typing a command takes, which the demo's own clock has to know
     about or it would move on while the machine was still being typed at. */
  function typeMs(command) {
    if (REDUCED) return 220;
    return command.length * (TYPE_MS + TYPE_JITTER / 2) + RETURN_MS;
  }

  function type(command, done) {
    if (!term) {
      later(done, REDUCED ? 0 : RETURN_MS);
      return;
    }

    /* A press that lands while a command is still running gets a prompt of its
       own rather than typing over the line that is already busy. */
    if (!line) prompt();

    var row = line.row;
    var cmd = line.cmd;

    if (REDUCED) {
      cmd.textContent = command;
      later(function () {
        submit(row);
        done();
      }, 220);
      return;
    }

    row.setAttribute("data-typing", "true");
    var at = 0;

    for (var i = 1; i <= command.length; i++) {
      at += TYPE_MS + Math.random() * TYPE_JITTER;
      (function (n, delay) {
        later(function () {
          cmd.textContent = command.slice(0, n);
        }, delay);
      })(i, at);
    }

    later(function () {
      submit(row);
      done();
    }, at + RETURN_MS);
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

  var HHMM = function (date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  /*
    And what it would print while doing it. The real command answers with the
    times it is working from, so this one does too, off the same solar functions
    and the visitor's own timezone: the numbers on the screen are the numbers
    their machine would show tonight.
  */
  function sunOutput() {
    print("sun mode armed");

    var api = window.__kbdlightSunPreview;
    if (!api || !api.locate || !api.timesFor) return;

    var where = api.locate();
    if (!where) return;

    var now = new Date();
    var times = api.timesFor(now, where.lat, where.lon);

    if (times.polar) {
      var up = times.polar === "day";
      print("  sun     " + (up ? "up" : "down") + " all day at this latitude");
      print("  now     " + (up ? "day, level off" : "night, level 0.60"));
      return;
    }

    var daylight = now >= times.sunrise && now < times.sunset;
    print("  sunrise " + HHMM(times.sunrise) + "   sunset " + HHMM(times.sunset));
    print("  now     " + (daylight ? "day, level off" : "night, level 0.60"));
  }

  function applySun() {
    var level = sunLevel();
    sunOutput();
    if (level !== null) setGlow(level);
    return 0;
  }

  /* --------------------------------------------------------------- pulse */

  /*
    Four blinks, then back to exactly the level it started from. The restore is
    the point of the real command and so it is the point here too: a demo that
    left the keyboard somewhere else would be demonstrating the wrong thing.

    Returns how long it will be busy for. The prompt does not come back until a
    command has finished, and this is the only one of the five that takes long
    enough for the difference to be visible.
  */
  function pulse() {
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

    return at;
  }

  /* ------------------------------------------------------------- controls */

  /* What the command does once return has been pressed on it, and how long the
     shell is busy with it afterwards. */
  function execute(button) {
    var action = button.getAttribute("data-mb-action");

    if (action === "pulse") return pulse();
    if (action === "sun") return applySun();

    setGlow(parseFloat(button.getAttribute("data-mb-level")));
    return 0;
  }

  /*
    Type it, run it, hand the prompt back. clearTimers first, so a command
    pressed while another is still being typed takes the line over rather than
    interleaving with it: an animation you cannot interrupt is worse than none.
  */
  function run(button) {
    clearTimers();
    mark(button);

    var command = button.getAttribute("aria-label") || "";

    type(command, function () {
      var busy = execute(button);
      later(prompt, busy);
    });
  }

  for (var i = 0; i < buttons.length; i++) {
    buttons[i].addEventListener("click", function (event) {
      handOver();
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

    It hands over the moment somebody does press a button, and stays handed over
    while they are still pressing them: something that keeps moving on its own
    while you have hold of it is the whole reason carousels are hated. Twelve
    quiet seconds later it picks the loop back up, because a demo left frozen on
    whatever the visitor pressed last is not demonstrating anything either.
  */
  var HOLD_MS = 1900; /* how long a finished command stays up, typing aside */
  var RESUME_MS = 12000; /* quiet time after a press before the loop returns */
  var cycleTimer = null;
  var handTimer = null;
  var cycleAt = 0;
  /* Reduced motion means what it says: the machine stays where it is, lit for
     the visitor's own hour, and the buttons still work. */
  var cycling = !REDUCED && buttons.length > 0;
  var onScreen = false;

  /* A step is however long the command takes to type plus however long it is
     worth looking at afterwards. A pulse is not a beat you can hold for a fixed
     time: it is four blinks at the real command's timings, so its slot is as
     long as that takes plus a breath at the end. */
  function stepMs(button) {
    var lead = typeMs(button.getAttribute("aria-label") || "");
    if (button.getAttribute("data-mb-action") !== "pulse") return lead + HOLD_MS;
    var blinks = REDUCED ? 1 : PULSE.count;
    return lead + PULSE.preDarkMs + blinks * (PULSE.onMs + PULSE.offMs) + 700;
  }

  /* Somebody pressed a button: stand down, and start counting the quiet. */
  function handOver() {
    cycling = false;
    if (cycleTimer !== null) window.clearTimeout(cycleTimer);
    cycleTimer = null;
    if (handTimer !== null) window.clearTimeout(handTimer);
    if (REDUCED || buttons.length === 0) return;
    handTimer = window.setTimeout(function () {
      handTimer = null;
      cycling = true;
      resumeCycling();
    }, RESUME_MS);
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

  /* ---------------------------------------------------------------- start */

  /*
    Light it for the visitor's own evening, without marking a button: nothing
    has been pressed yet, and the sun state is where it starts from.

    The markup ships the terminal with that command already sitting in it, so
    the opening state is the one the shell would be in a moment after it ran:
    its output underneath it, and an empty prompt waiting.
  */
  var initial = sunLevel();
  if (initial !== null) setGlow(initial);

  if (term) {
    sunOutput();
    prompt();
  }
})();
