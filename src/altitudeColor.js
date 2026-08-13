/**
 * Altitude → marker color, matching tar1090 / globe.adsbexchange.com
 * (tar1090 html/defaults.js).
 */

const UNKNOWN = { h: 0, s: 0, l: 75 };
const GROUND = { h: 220, s: 0, l: 30 };

const AIR_HUE = [
  [0, 20],
  [2000, 32.5],
  [4000, 43],
  [6000, 54],
  [8000, 72],
  [9000, 85],
  [11000, 140],
  [40000, 300],
  [51000, 360],
];

const AIR_SATURATION = 88;

const AIR_LIGHTNESS = [
  [0, 53],
  [20, 50],
  [32, 54],
  [40, 52],
  [46, 51],
  [50, 46],
  [60, 43],
  [80, 41],
  [100, 41],
  [120, 41],
  [140, 41],
  [160, 40],
  [180, 40],
  [190, 44],
  [198, 50],
  [200, 58],
  [220, 58],
  [240, 58],
  [255, 55],
  [266, 55],
  [270, 58],
  [280, 58],
  [290, 47],
  [300, 43],
  [310, 48],
  [320, 48],
  [340, 52],
  [360, 53],
];

function interpolate(table, x) {
  let value = table[0][1];
  for (let i = table.length - 1; i >= 0; i--) {
    const [px, py] = table[i];
    if (x > px) {
      if (i === table.length - 1) {
        value = py;
      } else {
        const [nx, ny] = table[i + 1];
        value = py + (ny - py) * ((x - px) / (nx - px));
      }
      break;
    }
  }
  return value;
}

function normalizeHue(h) {
  let hue = h;
  if (hue < 0) hue = (hue % 360) + 360;
  else if (hue >= 360) hue %= 360;
  return hue;
}

function hslToCss(h, s, l) {
  return `hsl(${h.toFixed(1)} ${s.toFixed(1)}% ${l.toFixed(1)}%)`;
}

function hslFor(altitudeFt, onGround) {
  if (onGround) return GROUND;
  if (altitudeFt == null || Number.isNaN(altitudeFt)) return UNKNOWN;

  const altRound = altitudeFt < 8000 ? 50 : 500;
  const altitude = altRound * Math.round(altitudeFt / altRound);
  const hue = normalizeHue(interpolate(AIR_HUE, altitude));
  const lightness = Math.min(95, Math.max(0, interpolate(AIR_LIGHTNESS, hue)));
  const saturation = Math.min(95, AIR_SATURATION);
  return { h: hue, s: saturation, l: lightness };
}

export function isOnGround(ac) {
  return ac.alt_baro === "ground";
}

export function altitudeFt(ac) {
  if (isOnGround(ac)) return 0;
  if (typeof ac.alt_baro === "number") return ac.alt_baro;
  if (typeof ac.alt_geom === "number") return ac.alt_geom;
  return null;
}

export function colorForAircraft(ac) {
  const { h, s, l } = hslFor(altitudeFt(ac), isOnGround(ac));
  return hslToCss(h, s, l);
}

export function colorForAltitude(ft, onGround = false) {
  const { h, s, l } = hslFor(ft, onGround);
  return hslToCss(h, s, l);
}

/** Sampled gradient stops for the on-map altitude legend. */
export function legendStops() {
  const alts = [0, 2000, 4000, 8000, 11000, 20000, 30000, 40000, 51000];
  return alts.map((ft, i) => `${colorForAltitude(ft)} ${(i / (alts.length - 1)) * 100}%`);
}
