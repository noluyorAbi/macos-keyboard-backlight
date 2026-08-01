'use strict';

// Where the Mac is, well enough to compute a sunrise.
//
// WHY THE TIMEZONE AND NOT A LOCATION LOOKUP
//   The two obvious alternatives are worse. CoreLocation needs an entitlement
//   and a permission prompt that a command-line tool cannot present properly,
//   and an IP geolocation service means a network call, a third party, and your
//   address leaving the machine every time a backlight wants to know the hour.
//   An IANA timezone is already a place name, it is already on the machine, and
//   it costs nothing. Its error is the width of a timezone: tens of minutes at
//   worst, and typically far less, because these zones are named after the city
//   most of their population lives in.
//
//   That is accurate enough for a keyboard. When it is not, `--at <lat,lon>`
//   takes exact coordinates and stops guessing.

// Representative coordinates for each zone: the city the zone is named after,
// or its dominant one. Latitude north positive, longitude east positive.
const TZ_COORDS = {
  // Europe
  'Europe/London': [51.51, -0.13],
  'Europe/Dublin': [53.35, -6.26],
  'Europe/Lisbon': [38.72, -9.14],
  'Europe/Madrid': [40.42, -3.7],
  'Europe/Paris': [48.86, 2.35],
  'Europe/Brussels': [50.85, 4.35],
  'Europe/Amsterdam': [52.37, 4.9],
  'Europe/Luxembourg': [49.61, 6.13],
  'Europe/Berlin': [52.52, 13.41],
  'Europe/Zurich': [47.38, 8.54],
  'Europe/Vienna': [48.21, 16.37],
  'Europe/Rome': [41.9, 12.5],
  'Europe/Malta': [35.9, 14.51],
  'Europe/Monaco': [43.73, 7.42],
  'Europe/Andorra': [42.51, 1.52],
  'Europe/Prague': [50.09, 14.42],
  'Europe/Bratislava': [48.15, 17.11],
  'Europe/Warsaw': [52.23, 21.01],
  'Europe/Budapest': [47.5, 19.04],
  'Europe/Ljubljana': [46.06, 14.51],
  'Europe/Zagreb': [45.81, 15.98],
  'Europe/Sarajevo': [43.86, 18.41],
  'Europe/Belgrade': [44.79, 20.45],
  'Europe/Skopje': [41.99, 21.43],
  'Europe/Tirane': [41.33, 19.82],
  'Europe/Sofia': [42.7, 23.32],
  'Europe/Bucharest': [44.43, 26.1],
  'Europe/Chisinau': [47.01, 28.86],
  'Europe/Athens': [37.98, 23.73],
  'Europe/Istanbul': [41.01, 28.98],
  'Europe/Copenhagen': [55.68, 12.57],
  'Europe/Oslo': [59.91, 10.75],
  'Europe/Stockholm': [59.33, 18.07],
  'Europe/Helsinki': [60.17, 24.94],
  'Europe/Tallinn': [59.44, 24.75],
  'Europe/Riga': [56.95, 24.11],
  'Europe/Vilnius': [54.69, 25.28],
  'Europe/Minsk': [53.9, 27.57],
  'Europe/Kyiv': [50.45, 30.52],
  'Europe/Moscow': [55.76, 37.62],
  'Europe/Kaliningrad': [54.71, 20.51],
  'Europe/Samara': [53.2, 50.15],
  'Europe/Reykjavik': [64.15, -21.94],
  'Atlantic/Canary': [28.29, -16.63],
  'Atlantic/Azores': [37.74, -25.68],

  // Americas
  'America/St_Johns': [47.56, -52.71],
  'America/Halifax': [44.65, -63.57],
  'America/New_York': [40.71, -74.01],
  'America/Toronto': [43.65, -79.38],
  'America/Montreal': [45.5, -73.57],
  'America/Detroit': [42.33, -83.05],
  'America/Indiana/Indianapolis': [39.77, -86.16],
  'America/Chicago': [41.88, -87.63],
  'America/Winnipeg': [49.9, -97.14],
  'America/Regina': [50.45, -104.62],
  'America/Denver': [39.74, -104.99],
  'America/Edmonton': [53.55, -113.49],
  'America/Boise': [43.62, -116.2],
  'America/Phoenix': [33.45, -112.07],
  'America/Los_Angeles': [34.05, -118.24],
  'America/Vancouver': [49.28, -123.12],
  'America/Anchorage': [61.22, -149.9],
  'Pacific/Honolulu': [21.31, -157.86],
  'America/Mexico_City': [19.43, -99.13],
  'America/Guatemala': [14.63, -90.51],
  'America/Costa_Rica': [9.93, -84.09],
  'America/Panama': [8.98, -79.52],
  'America/Havana': [23.11, -82.37],
  'America/Jamaica': [18.01, -76.79],
  'America/Puerto_Rico': [18.47, -66.11],
  'America/Santo_Domingo': [18.49, -69.93],
  'America/Caracas': [10.48, -66.9],
  'America/Bogota': [4.71, -74.07],
  'America/Guayaquil': [-2.19, -79.89],
  'America/Lima': [-12.05, -77.04],
  'America/La_Paz': [-16.5, -68.15],
  'America/Asuncion': [-25.28, -57.63],
  'America/Santiago': [-33.45, -70.67],
  'America/Montevideo': [-34.9, -56.16],
  'America/Argentina/Buenos_Aires': [-34.6, -58.38],
  'America/Sao_Paulo': [-23.55, -46.63],

  // Asia
  'Asia/Nicosia': [35.19, 33.38],
  'Asia/Jerusalem': [31.77, 35.21],
  'Asia/Beirut': [33.89, 35.5],
  'Asia/Damascus': [33.51, 36.29],
  'Asia/Amman': [31.95, 35.93],
  'Asia/Baghdad': [33.31, 44.36],
  'Asia/Kuwait': [29.38, 47.99],
  'Asia/Riyadh': [24.71, 46.68],
  'Asia/Qatar': [25.29, 51.53],
  'Asia/Dubai': [25.2, 55.27],
  'Asia/Muscat': [23.59, 58.41],
  'Asia/Tehran': [35.69, 51.39],
  'Asia/Baku': [40.41, 49.87],
  'Asia/Tbilisi': [41.72, 44.79],
  'Asia/Yerevan': [40.18, 44.51],
  'Asia/Kabul': [34.53, 69.17],
  'Asia/Karachi': [24.86, 67.01],
  'Asia/Kolkata': [22.57, 88.36],
  'Asia/Kathmandu': [27.72, 85.32],
  'Asia/Dhaka': [23.81, 90.41],
  'Asia/Colombo': [6.93, 79.86],
  'Asia/Yangon': [16.87, 96.2],
  'Asia/Bangkok': [13.76, 100.5],
  'Asia/Ho_Chi_Minh': [10.82, 106.63],
  'Asia/Kuala_Lumpur': [3.14, 101.69],
  'Asia/Singapore': [1.35, 103.82],
  'Asia/Jakarta': [-6.21, 106.85],
  'Asia/Manila': [14.6, 120.98],
  'Asia/Hong_Kong': [22.32, 114.17],
  'Asia/Taipei': [25.03, 121.57],
  'Asia/Shanghai': [31.23, 121.47],
  'Asia/Seoul': [37.57, 126.98],
  'Asia/Tokyo': [35.68, 139.65],
  'Asia/Ulaanbaatar': [47.89, 106.91],
  'Asia/Almaty': [43.24, 76.89],
  'Asia/Tashkent': [41.3, 69.24],
  'Asia/Yekaterinburg': [56.84, 60.61],
  'Asia/Novosibirsk': [55.03, 82.92],
  'Asia/Vladivostok': [43.12, 131.89],

  // Africa
  'Africa/Casablanca': [33.57, -7.59],
  'Africa/Algiers': [36.75, 3.06],
  'Africa/Tunis': [36.81, 10.18],
  'Africa/Tripoli': [32.89, 13.19],
  'Africa/Cairo': [30.04, 31.24],
  'Africa/Khartoum': [15.5, 32.56],
  'Africa/Dakar': [14.72, -17.47],
  'Africa/Abidjan': [5.36, -4.01],
  'Africa/Accra': [5.6, -0.19],
  'Africa/Lagos': [6.52, 3.38],
  'Africa/Kinshasa': [-4.44, 15.27],
  'Africa/Luanda': [-8.84, 13.23],
  'Africa/Addis_Ababa': [9.03, 38.74],
  'Africa/Nairobi': [-1.29, 36.82],
  'Africa/Kampala': [0.35, 32.58],
  'Africa/Dar_es_Salaam': [-6.79, 39.21],
  'Africa/Lusaka': [-15.39, 28.32],
  'Africa/Harare': [-17.83, 31.05],
  'Africa/Maputo': [-25.97, 32.58],
  'Africa/Windhoek': [-22.56, 17.08],
  'Africa/Johannesburg': [-26.2, 28.05],

  // Oceania
  'Australia/Perth': [-31.95, 115.86],
  'Australia/Darwin': [-12.46, 130.84],
  'Australia/Adelaide': [-34.93, 138.6],
  'Australia/Brisbane': [-27.47, 153.03],
  'Australia/Sydney': [-33.87, 151.21],
  'Australia/Melbourne': [-37.81, 144.96],
  'Australia/Hobart': [-42.88, 147.33],
  'Pacific/Auckland': [-36.85, 174.76],
  'Pacific/Fiji': [-18.14, 178.44],
  'Pacific/Guam': [13.44, 144.79],
  'Pacific/Port_Moresby': [-9.44, 147.18],

  // A machine set to plain UTC is telling us nothing about where it is, so this
  // is Greenwich: the one place on Earth where UTC is the local solar time.
  UTC: [51.48, 0],
};

// Zones macOS still hands out under their historic names.
const TZ_ALIASES = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Europe/Kiev': 'Europe/Kyiv',
  'Europe/Uzhgorod': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'America/Indianapolis': 'America/Indiana/Indianapolis',
  'Africa/Asmera': 'Africa/Addis_Ababa',
  Etc: 'UTC',
  'Etc/UTC': 'UTC',
  'Etc/GMT': 'UTC',
  GMT: 'UTC',
  'Universal': 'UTC',
};

function coordsForTimezone(tz) {
  const zone = TZ_ALIASES[tz] || tz;
  const found = TZ_COORDS[zone];
  return found ? { lat: found[0], lon: found[1] } : null;
}

// Coordinates for this machine, from the timezone it is set to.
function locate() {
  let tz;
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (e) {
    tz = null;
  }
  if (!tz) throw new Error('this machine reports no timezone; pass --at <lat,lon>');

  const found = coordsForTimezone(tz);
  if (!found) {
    throw new Error(
      'no coordinates on file for the timezone "' +
        tz +
        '"; pass them once with --at <lat,lon>'
    );
  }
  return { lat: found.lat, lon: found.lon, source: tz };
}

// "48.14,11.58" and "48.14 11.58" both parse. A silently wrong location would
// show up as a sunrise an hour out, so every failure here is loud.
function parseCoords(input) {
  const parts = String(input)
    .trim()
    .split(/[\s,]+/)
    .filter(Boolean);
  if (parts.length !== 2) {
    throw new Error('coordinates look like "48.14,11.58", got "' + input + '"');
  }

  const lat = Number(parts[0]);
  const lon = Number(parts[1]);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw new Error('latitude must be between -90 and 90, got "' + parts[0] + '"');
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    throw new Error('longitude must be between -180 and 180, got "' + parts[1] + '"');
  }
  return { lat, lon, source: 'manual' };
}

module.exports = { locate, parseCoords, coordsForTimezone, TZ_COORDS, TZ_ALIASES };
