'use strict';

// Sunrise and sunset from coordinates, with no dependency and no network call.
//
// This is the NOAA solar position algorithm, the same one behind NOAA's own
// sunrise calculator. It is accurate to about a minute for latitudes under 72
// degrees, which is far past what a keyboard backlight can tell apart.
//
// Everything here works in UTC and returns absolute Date objects. Timezones are
// only ever used to decide *which calendar day* is meant, never to shift a
// result, because an absolute instant compares correctly no matter where the
// machine thinks it is.

const rad = (d) => (d * Math.PI) / 180;
const deg = (r) => (r * 180) / Math.PI;
const mod360 = (d) => ((d % 360) + 360) % 360;

// Sunrise is defined at 90.833 degrees of zenith, not 90: half a degree for the
// radius of the solar disc, and a third for atmospheric refraction lifting the
// image of the sun above where the sun geometrically is.
const SUNRISE_ZENITH = 90.833;

const MINUTE = 60000;
const DAY = 86400000;

function julianCentury(date) {
  const julianDay = date.getTime() / DAY + 2440587.5;
  return (julianDay - 2451545) / 36525;
}

// Declination of the sun (degrees) and the equation of time (minutes), the two
// numbers every other result here is built from.
function solarParams(t) {
  const meanLong = mod360(280.46646 + t * (36000.76983 + t * 0.0003032));
  const meanAnom = 357.52911 + t * (35999.05029 - 0.0001537 * t);
  const eccentricity = 0.016708634 - t * (0.000042037 + 0.0000001267 * t);

  const center =
    Math.sin(rad(meanAnom)) * (1.914602 - t * (0.004817 + 0.000014 * t)) +
    Math.sin(rad(2 * meanAnom)) * (0.019993 - 0.000101 * t) +
    Math.sin(rad(3 * meanAnom)) * 0.000289;

  // Nutation and aberration, the two corrections between where the sun is and
  // where it appears to be from here.
  const omega = 125.04 - 1934.136 * t;
  const appLong = meanLong + center - 0.00569 - 0.00478 * Math.sin(rad(omega));

  const meanObliq =
    23 + (26 + (21.448 - t * (46.815 + t * (0.00059 - t * 0.001813))) / 60) / 60;
  const obliq = meanObliq + 0.00256 * Math.cos(rad(omega));

  const declination = deg(Math.asin(Math.sin(rad(obliq)) * Math.sin(rad(appLong))));

  const y = Math.pow(Math.tan(rad(obliq / 2)), 2);
  const eqTime =
    4 *
    deg(
      y * Math.sin(2 * rad(meanLong)) -
        2 * eccentricity * Math.sin(rad(meanAnom)) +
        4 * eccentricity * y * Math.sin(rad(meanAnom)) * Math.cos(2 * rad(meanLong)) -
        0.5 * y * y * Math.sin(4 * rad(meanLong)) -
        1.25 * eccentricity * eccentricity * Math.sin(2 * rad(meanAnom))
    );

  return { declination, eqTime };
}

function checkCoords(lat, lon) {
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('latitude must be a number between -90 and 90');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('longitude must be a number between -180 and 180');
  }
}

// Sunrise, sunset and solar noon for the calendar day that `when` falls on in
// the machine's local timezone.
//
// Above the polar circles the sun can fail to cross the horizon at all. That is
// not an error and it is not a missing value to paper over: `polar` says which
// of the two it is, and sunrise/sunset are null because they did not happen.
function timesFor(when, lat, lon) {
  checkCoords(lat, lon);

  const midnightUTC = Date.UTC(when.getFullYear(), when.getMonth(), when.getDate());
  // Solar parameters are evaluated at midday, the middle of the span they are
  // used for, which keeps the error from the sun's own motion symmetric.
  const { declination, eqTime } = solarParams(julianCentury(new Date(midnightUTC + DAY / 2)));

  const noonMinutes = 720 - 4 * lon - eqTime;
  const at = (minutes) => new Date(midnightUTC + minutes * MINUTE);
  const solarNoon = at(noonMinutes);

  const cosHourAngle =
    Math.cos(rad(SUNRISE_ZENITH)) / (Math.cos(rad(lat)) * Math.cos(rad(declination))) -
    Math.tan(rad(lat)) * Math.tan(rad(declination));

  if (cosHourAngle < -1) {
    return { sunrise: null, sunset: null, solarNoon, polar: 'day' }; // midnight sun
  }
  if (cosHourAngle > 1) {
    return { sunrise: null, sunset: null, solarNoon, polar: 'night' }; // polar night
  }

  const hourAngle = deg(Math.acos(cosHourAngle));
  return {
    sunrise: at(noonMinutes - 4 * hourAngle),
    sunset: at(noonMinutes + 4 * hourAngle),
    solarNoon,
    polar: null,
  };
}

// Same, for the day after `when`. Used to answer "when does it next get dark"
// once today's sunset is already behind us.
function timesForNextDay(when, lat, lon) {
  const tomorrow = new Date(when.getTime());
  tomorrow.setDate(tomorrow.getDate() + 1);
  return timesFor(tomorrow, lat, lon);
}

module.exports = { timesFor, timesForNextDay, solarParams, julianCentury, SUNRISE_ZENITH };
