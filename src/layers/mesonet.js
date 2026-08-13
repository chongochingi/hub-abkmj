import L from "leaflet";
import {
  MESONET_POLL_MS,
  MESONET_URL,
  MESONET_VARS,
  STORAGE_KEY,
} from "../config.js";

const FROM_DEG = {
  N: 0,
  NNE: 22.5,
  NE: 45,
  ENE: 67.5,
  E: 90,
  ESE: 112.5,
  SE: 135,
  SSE: 157.5,
  S: 180,
  SSW: 202.5,
  SW: 225,
  WSW: 247.5,
  W: 270,
  WNW: 292.5,
  NW: 315,
  NNW: 337.5,
};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").mesonet || {};
  } catch {
    return {};
  }
}

function saveState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.mesonet = { ...(all.mesonet || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

function num(value) {
  const n = Number(String(value ?? "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = line.split(",");
    const row = {};
    headers.forEach((key, i) => {
      row[key] = (cols[i] ?? "").trim();
    });
    return {
      id: row.STID,
      name: row.NAME || row.STID,
      lat: num(row.LAT),
      lon: num(row.LON),
      year: num(row.YR),
      month: num(row.MO),
      day: num(row.DA),
      hour: num(row.HR),
      minute: num(row.MI),
      temp: num(row.TAIR),
      dew: num(row.TDEW),
      rh: num(row.RELH),
      chill: num(row.CHIL),
      heat: num(row.HEAT),
      wdir: row.WDIR || "",
      wspd: num(row.WSPD),
      wmax: num(row.WMAX),
      pres: num(row.PRES),
      tmax: num(row.TMAX),
      tmin: num(row.TMIN),
      rain: num(row.RAIN) ?? 0,
    };
  }).filter((s) => s.id && s.lat != null && s.lon != null);
}

function fmt(value, unit, digits = 0) {
  if (value == null) return "—";
  return `${value.toFixed(digits)}${unit}`;
}

function obsStamp(s) {
  if ([s.year, s.month, s.day, s.hour, s.minute].some((n) => n == null)) return null;
  const mo = String(s.month).padStart(2, "0");
  const da = String(s.day).padStart(2, "0");
  const hr = String(s.hour).padStart(2, "0");
  const mi = String(s.minute).padStart(2, "0");
  const d = new Date(`${s.year}-${mo}-${da}T${hr}:${mi}:00-06:00`);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function popupHtml(s) {
  const when = obsStamp(s);
  const wind =
    s.wspd != null
      ? `${s.wdir || "—"} ${Math.round(s.wspd)} mph (${Math.round(mphToKnots(s.wspd))} kt)${s.wmax != null ? ` · gust ${Math.round(s.wmax)} mph` : ""}`
      : "—";
  return `
    <div class="popup-kicker">Oklahoma Mesonet</div>
    <div class="popup-title">${s.name}</div>
    <div class="popup-row">${s.id}${when ? ` · ${when}` : ""}</div>
    <div class="popup-row">Temp ${fmt(s.temp, "°F")} · Dew ${fmt(s.dew, "°F")} · RH ${fmt(s.rh, "%")}</div>
    <div class="popup-row">Wind ${wind}</div>
    <div class="popup-row">Rain today ${fmt(s.rain, '"', 2)}</div>
    ${s.pres != null ? `<div class="popup-row">Pressure ${s.pres.toFixed(1)} mb</div>` : ""}
  `;
}

function mphToKnots(mph) {
  return mph * 0.868976;
}

function windBarbSvg(mph, fromDeg) {
  const size = 48;
  const cx = 24;
  const cy = 24;
  const color = "#0f172a";
  const halo = `stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const ink = `stroke="${color}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  const dot = `<circle cx="${cx}" cy="${cy}" r="2.3" fill="${color}" stroke="#fff" stroke-width="1"/>`;

  if (mph == null || fromDeg == null) {
    return `<svg class="meso-barb" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">${dot}</svg>`;
  }

  const knots = mphToKnots(mph);
  if (knots < 2.5) {
    return `<svg class="meso-barb" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
      <circle cx="${cx}" cy="${cy}" r="5.2" fill="none" stroke="#fff" stroke-width="3"/>
      <circle cx="${cx}" cy="${cy}" r="5.2" fill="none" stroke="${color}" stroke-width="1.6"/>
      ${dot}
    </svg>`;
  }

  let kt = Math.round(knots / 5) * 5;
  if (kt < 5) kt = 5;
  const flags = Math.floor(kt / 50);
  const rest = kt % 50;
  const full = Math.floor(rest / 10);
  const half = rest % 10 >= 5 ? 1 : 0;

  const shaft = 18;
  const barbLen = 11;
  const halfLen = 6.2;
  const step = 4.1;
  const flagH = 7;
  const tipY = cy - shaft;
  const slant = 0.48;

  const lines = [];
  function shaftLine(extra) {
    lines.push(`<line x1="${cx}" y1="${cy}" x2="${cx}" y2="${tipY}" ${extra}/>`);
  }
  function barb(y, len, extra) {
    lines.push(`<line x1="${cx}" y1="${y}" x2="${cx - len}" y2="${y - len * slant}" ${extra}/>`);
  }
  function flag(y, extraFill, extraStroke) {
    const y2 = y + flagH;
    lines.push(
      `<polygon points="${cx},${y} ${cx - barbLen},${y + flagH * 0.42} ${cx},${y2}" ${extraFill} ${extraStroke}/>`,
    );
  }

  shaftLine(halo);
  let y = tipY;
  for (let i = 0; i < flags; i++) {
    flag(y, `fill="#fff"`, `stroke="#fff" stroke-width="2.4" stroke-linejoin="round"`);
    y += flagH;
  }
  if (flags && (full || half)) y += 1.2;
  for (let i = 0; i < full; i++) {
    barb(y, barbLen, halo);
    y += step;
  }
  if (half) {
    if (!flags && !full) y += step;
    barb(y, halfLen, halo);
  }

  shaftLine(ink);
  y = tipY;
  for (let i = 0; i < flags; i++) {
    flag(y, `fill="${color}"`, `stroke="${color}" stroke-width="0.6" stroke-linejoin="round"`);
    y += flagH;
  }
  if (flags && (full || half)) y += 1.2;
  for (let i = 0; i < full; i++) {
    barb(y, barbLen, ink);
    y += step;
  }
  if (half) {
    if (!flags && !full) y += step;
    barb(y, halfLen, ink);
  }

  return `<svg class="meso-barb" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <g transform="rotate(${fromDeg} ${cx} ${cy})">${lines.join("")}</g>
    ${dot}
  </svg>`;
}

function rainColor(inches) {
  if (!inches) return "#64748b";
  if (inches >= 2) return "#db2777";
  if (inches >= 1) return "#7c3aed";
  if (inches >= 0.5) return "#2563eb";
  if (inches >= 0.1) return "#0ea5e9";
  return "#7dd3fc";
}

function tempColor(f) {
  if (f == null) return "#64748b";
  if (f >= 100) return "#b91c1c";
  if (f >= 90) return "#ea580c";
  if (f >= 80) return "#f59e0b";
  if (f >= 60) return "#22c55e";
  if (f >= 40) return "#38bdf8";
  return "#6366f1";
}

function humidityColor(rh) {
  if (rh == null) return "#64748b";
  if (rh >= 80) return "#1d4ed8";
  if (rh >= 60) return "#0ea5e9";
  if (rh >= 40) return "#22c55e";
  if (rh >= 20) return "#eab308";
  return "#f97316";
}

function toDeg(dir) {
  return FROM_DEG[String(dir).toUpperCase()] ?? null;
}

function makeIcon(s, variable, showLabel) {
  if (variable === "wind") {
    return L.divIcon({
      className: "meso-marker",
      iconSize: [48, 48],
      iconAnchor: [24, 24],
      html: windBarbSvg(s.wspd, toDeg(s.wdir)),
    });
  }

  let text = "—";
  let color = "#64748b";
  if (variable === "rain") {
    text = s.rain ? s.rain.toFixed(s.rain >= 1 ? 1 : 2) : "0";
    color = rainColor(s.rain);
  } else if (variable === "temp") {
    text = s.temp != null ? `${Math.round(s.temp)}°` : "—";
    color = tempColor(s.temp);
  } else if (variable === "humidity") {
    text = s.rh != null ? `${Math.round(s.rh)}%` : "—";
    color = humidityColor(s.rh);
  }

  return L.divIcon({
    className: "meso-marker",
    iconSize: [36, 18],
    iconAnchor: [18, 9],
    html: `<div class="meso-pill" style="background:${color}">${showLabel ? text : ""}</div>`,
  });
}

export function createMesonetLayer(map) {
  const saved = loadState();
  let variable = MESONET_VARS.some((v) => v.id === saved.variable)
    ? saved.variable
    : "wind";

  const group = L.layerGroup();
  const markers = new Map();
  let stations = [];
  let timer = null;
  let extrasRoot = null;
  let error = null;
  let onChange = () => {};

  function persist() {
    saveState({ variable });
  }

  function showLabels() {
    return map.getZoom() >= 8;
  }

  function renderMarker(s) {
    const icon = makeIcon(s, variable, showLabels());
    const existing = markers.get(s.id);
    if (existing) {
      existing.setLatLng([s.lat, s.lon]);
      existing.setIcon(icon);
      existing.setPopupContent(popupHtml(s));
      existing._hub = s;
      return;
    }
    const marker = L.marker([s.lat, s.lon], { icon, zIndexOffset: 280 })
      .bindPopup(popupHtml(s));
    marker._hub = s;
    marker.addTo(group);
    markers.set(s.id, marker);
  }

  function sync() {
    const seen = new Set();
    for (const s of stations) {
      seen.add(s.id);
      renderMarker(s);
    }
    for (const [id, marker] of markers) {
      if (!seen.has(id)) {
        group.removeLayer(marker);
        markers.delete(id);
      }
    }
  }

  function setVariable(next) {
    if (variable === next) return;
    variable = next;
    persist();
    sync();
    renderExtras();
    onChange();
  }

  function renderExtras() {
    if (!extrasRoot) return;
    extrasRoot.querySelectorAll("[data-var]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.var === variable);
    });
  }

  async function tick() {
    try {
      const res = await fetch(MESONET_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Mesonet HTTP ${res.status}`);
      stations = parseCsv(await res.text());
      if (!stations.length) throw new Error("Mesonet feed empty");
      sync();
      error = null;
    } catch (err) {
      error = err.message || "Mesonet unavailable";
    }
    onChange();
  }

  map.on("zoomend", () => {
    if (!map.hasLayer(group)) return;
    for (const marker of markers.values()) {
      marker.setIcon(makeIcon(marker._hub, variable, showLabels()));
    }
  });

  return {
    id: "mesonet",
    name: "Oklahoma Mesonet",
    description: "Stations · wind barbs, rain, temp, humidity",
    color: "#38bdf8",
    defaultOn: true,
    getCount: () => stations.length,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    mountExtras(container) {
      extrasRoot = container;
      container.innerHTML = `
        <div class="meso-vars">
          ${MESONET_VARS.map(
            (v) =>
              `<button type="button" class="meso-chip" data-var="${v.id}">${v.label}</button>`,
          ).join("")}
        </div>
      `;
      container.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-var]");
        if (btn) setVariable(btn.dataset.var);
      });
      renderExtras();
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, MESONET_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
