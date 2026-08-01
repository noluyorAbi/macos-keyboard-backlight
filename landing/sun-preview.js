/* ==========================================================================
   sun-preview.js, the one piece of this page that computes something.

   The sun section ships a labelled example day. This replaces it with the
   visitor's own: sunrise and sunset for today, where they are, and which side
   of them the clock is on right now.

   It is the product demonstrating itself. The maths below is the NOAA solar
   algorithm from src/solar.js, and the coordinates come from the visitor's IANA
   timezone through the table in src/geo.js, which sync.mjs writes out as
   sun-data.js. That is exactly what `kbdlight sun` does on a Mac, so the times
   drawn here are the times the command would switch at.

   Nothing is fetched, nothing is stored, and no location is ever requested. A
   timezone is not a location, which is the entire point: the page knows roughly
   which city, the same as the command, and nothing more.

   Degrading: if there is no data file, no timezone, or no entry for it, this
   returns without touching anything and the example day stands. An unknown
   visitor gets a page that is honest rather than a page that guesses.
   ========================================================================== */

(function () {
  "use strict";

  var data = window.__kbdlightSunData;

  /* ------------------------------------------------------------- solar */
  /* Mirrors src/solar.js. test/landing-preview.js fails if the two ever
     disagree by more than a few seconds, on any date, at any latitude. */
  var DAY = 86400000;
  var MINUTE = 60000;
  var SUNRISE_ZENITH = 90.833;

  function rad(d) {
    return (d * Math.PI) / 180;
  }
  function deg(r) {
    return (r * 180) / Math.PI;
  }
  function mod360(d) {
    return ((d % 360) + 360) % 360;
  }

  function julianCentury(ms) {
    return (ms / DAY + 2440587.5 - 2451545) / 36525;
  }

  function solarParams(t) {
    var meanLong = mod360(280.46646 + t * (36000.76983 + t * 0.0003032));
    var meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
    var eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

    var center =
      Math.sin(rad(meanAnom)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
      Math.sin(rad(2 * meanAnom)) * (0.019993 - 0.000101 * t) +
      Math.sin(rad(3 * meanAnom)) * 0.000289;

    var omega = 125.04 - 1934.136 * t;
    var appLong = meanLong + center - 0.00569 - 0.00478 * Math.sin(rad(omega));

    var meanObliq =
      23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
    var obliq = meanObliq + 0.00256 * Math.cos(rad(omega));

    var declination = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(appLong))));

    var y = Math.pow(Math.tan(rad(obliq / 2)), 2);
    var eqTime =
      4 *
      deg(
        y * Math.sin(2 * rad(meanLong)) -
          2 * eccentricity * Math.sin(rad(meanAnom)) +
          4 * eccentricity * y * Math.sin(rad(meanAnom)) * Math.cos(2 * rad(meanLong)) -
          0.5 * y * y * Math.sin(4 * rad(meanLong)) -
          1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnom)),
      );

    return { declination: declination, eqTime: eqTime };
  }

  /* Sunrise, sunset and solar noon for the local calendar day of `when`.
     Above the polar circles the sun may not cross the horizon at all, and
     `polar` says which way rather than returning a quiet NaN. */
  function timesFor(when, lat, lon) {
    var midnightUTC = Date.UTC(when.getFullYear(), when.getMonth(), when.getDate());
    var p = solarParams(julianCentury(midnightUTC + DAY / 2));
    var noonMinutes = 720 - 4 * lon - p.eqTime;

    function at(minutes) {
      return new Date(midnightUTC + minutes * MINUTE);
    }

    var cosHourAngle =
      Math.cos(rad(SUNRISE_ZENITH)) /
        (Math.cos(rad(lat)) * Math.cos(rad(p.declination))) -
      Math.tan(rad(lat)) * Math.tan(rad(p.declination));

    if (cosHourAngle < -1) {
      return { sunrise: null, sunset: null, solarNoon: at(noonMinutes), polar: "day" };
    }
    if (cosHourAngle > 1) {
      return { sunrise: null, sunset: null, solarNoon: at(noonMinutes), polar: "night" };
    }

    var hourAngle = deg(Math.acos(cosHourAngle));
    return {
      sunrise: at(noonMinutes - 4 * hourAngle),
      sunset: at(noonMinutes + 4 * hourAngle),
      solarNoon: at(noonMinutes),
      polar: null,
    };
  }

  /* ----------------------------------------------------------- location */
  function locate() {
    var tz;
    try {
      tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch (error) {
      return null;
    }
    if (!tz) return null;

    var zone = data.aliases[tz] || tz;
    var found = data.zones[zone];
    return found ? { lat: found[0], lon: found[1], zone: zone } : null;
  }

  /* -------------------------------------------------------------- paint */
  function clock(date) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  /* Position within the local day, as a percentage of its 24 hours. */
  function percentOfDay(date, dayStart) {
    return Math.max(0, Math.min(100, ((date - dayStart) / DAY) * 100));
  }

  function text(hook, value) {
    var el = root.querySelector("[" + hook + "]");
    if (el) el.textContent = value;
  }

  function paint() {
    var where = locate();
    if (!where) return;

    var now = new Date();
    var today = timesFor(now, where.lat, where.lon);
    var dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    /* Above the polar circles there is no sunrise to draw. Say so in words
       rather than drawing a band that would have to be invented. */
    if (today.polar) {
      var allDay = today.polar === "day";
      text("data-sun-rise", allDay ? "no sunrise" : "no sunrise");
      text("data-sun-set", allDay ? "no sunset" : "no sunset");
      text(
        "data-sun-phase",
        allDay ? "off, the sun does not set here today" : "lit, the sun does not rise here today",
      );
      root.style.setProperty("--sun-rise", allDay ? "0%" : "50%");
      root.style.setProperty("--sun-set", allDay ? "100%" : "50%");
    } else {
      var lit = now >= today.sunrise && now < today.sunset;
      text("data-sun-rise", clock(today.sunrise));
      text("data-sun-set", clock(today.sunset));
      text(
        "data-sun-phase",
        lit ? "off, it is daylight" : "lit, the sun is down",
      );
      root.style.setProperty("--sun-rise", percentOfDay(today.sunrise, dayStart) + "%");
      root.style.setProperty("--sun-set", percentOfDay(today.sunset, dayStart) + "%");
    }

    root.style.setProperty("--sun-now", percentOfDay(now, dayStart) + "%");

    /* Relabel last. Until this line the panel is honestly an example; after it
       the panel is honestly today, and it is never briefly both. */
    var label = root.getAttribute("data-sun-live-label");
    if (label) text("data-sun-label", label + ", " + where.zone.replace(/_/g, " "));
    root.setAttribute("data-sun-live", "true");
  }

  /* Exposed for test/landing-preview.js, which runs this file with no DOM and
     compares timesFor against src/solar.js. A copy of an algorithm that nothing
     checks is a copy that is already wrong. */
  window.__kbdlightSunPreview = { timesFor: timesFor, locate: locate };

  var root = document.querySelector("[data-sun-preview]");
  if (!data || !root) return;

  paint();

  /* The marker is a clock, so it has to keep being one for a tab left open. */
  window.setInterval(paint, 60000);
})();
