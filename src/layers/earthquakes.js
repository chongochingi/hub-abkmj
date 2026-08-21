import L from "leaflet";
import {
  DEFAULT_QUAKE_MAG,
  DEFAULT_QUAKE_PERIOD,
  STORAGE_KEY,
  USGS_QUAKE_FEED_BASE,
  USGS_QUAKE_MAGS,
  USGS_QUAKE_PERIODS,
  USGS_QUAKE_POLL_MS,
} from "../config.js";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function loadQuakeState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").earthquakes || {};
  } catch {
    return {};
  }
}

function saveQuakeState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.earthquakes = { ...(all.earthquakes || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

function feedUrl(mag, period) {
  return `${USGS_QUAKE_FEED_BASE}/${mag}_${period}.geojson`;
}

function magOf(props) {
  const n = Number(props?.mag);
  return Number.isFinite(n) ? n : null;
}

const HOUR_MS = 60 * 60 * 1000;

function ageMs(props) {
  const t = Number(props?.time);
  if (!Number.isFinite(t)) return Infinity;
  return Date.now() - t;
}

function recencyColor(props) {
  const ageH = ageMs(props) / HOUR_MS;
  if (!Number.isFinite(ageH)) return "#78716c";
  if (ageH <= 1) return "#ef4444";
  if (ageH <= 6) return "#f97316";
  if (ageH <= 24) return "#eab308";
  if (ageH <= 72) return "#facc15";
  if (ageH <= 168) return "#a8a29e";
  return "#78716c";
}

function magRadius(mag) {
  if (mag == null) return 3;
  return Math.max(2.5, Math.min(11, 1.5 + mag * 1.1));
}

function oldestFirst(data) {
  const features = [...(data.features || [])].sort(
    (a, b) => Number(a.properties?.time || 0) - Number(b.properties?.time || 0),
  );
  return { ...data, type: data.type || "FeatureCollection", features };
}

function stackOldestBehind(group) {
  const layers = [];
  group.eachLayer((layer) => layers.push(layer));
  layers
    .sort(
      (a, b) =>
        Number(a.feature?.properties?.time || 0) - Number(b.feature?.properties?.time || 0),
    )
    .forEach((layer) => layer.bringToFront());
}

function fmtWhen(ms) {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZoneName: "short",
  });
}

function depthKm(feature) {
  const depth = Number(feature?.geometry?.coordinates?.[2]);
  return Number.isFinite(depth) ? depth : null;
}

function popupHtml(feature) {
  const p = feature.properties || {};
  const mag = magOf(p);
  const depth = depthKm(feature);
  const magLabel = mag == null ? "—" : mag.toFixed(1);
  const felt = Number(p.felt);
  return `
    <div class="popup-kicker">USGS earthquake</div>
    <div class="popup-title">M${esc(magLabel)} · ${esc(p.place || "Unknown location")}</div>
    <div class="popup-row">${esc(fmtWhen(p.time))}</div>
    ${
      depth != null
        ? `<div class="popup-row">Depth ${esc(depth.toFixed(1))} km${p.magType ? ` · ${esc(p.magType)}` : ""}</div>`
        : ""
    }
    ${
      Number.isFinite(felt) && felt > 0
        ? `<div class="popup-row">${felt.toLocaleString()} felt report${felt === 1 ? "" : "s"}</div>`
        : ""
    }
    ${p.tsunami ? `<div class="popup-row quake-tsunami">Tsunami flag</div>` : ""}
    ${p.alert ? `<div class="popup-row">PAGER ${esc(p.alert)}</div>` : ""}
    ${
      p.url
        ? `<div class="popup-row"><a href="${esc(p.url)}" target="_blank" rel="noreferrer">USGS event page</a></div>`
        : ""
    }
  `;
}

export function createEarthquakesLayer(map) {
  const saved = loadQuakeState();
  let period = USGS_QUAKE_PERIODS.some((p) => p.id === saved.period)
    ? saved.period
    : DEFAULT_QUAKE_PERIOD;
  let mag = USGS_QUAKE_MAGS.some((m) => m.id === saved.mag) ? saved.mag : DEFAULT_QUAKE_MAG;
  let extrasRoot = null;
  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};
  let requestId = 0;

  const group = L.geoJSON(null, {
    pointToLayer(feature, latlng) {
      const magValue = magOf(feature.properties);
      const color = recencyColor(feature.properties);
      const recent = ageMs(feature.properties) <= HOUR_MS;
      return L.circleMarker(latlng, {
        radius: magRadius(magValue),
        color,
        fillColor: color,
        fillOpacity: recent ? 0.9 : 0.7,
        weight: recent ? 1.4 : 1,
        pane: "overlayPane",
        className: recent ? "quake-blink" : "",
      });
    },
    onEachFeature(feature, layer) {
      layer.bindPopup(popupHtml(feature));
    },
  });

  function persist() {
    saveQuakeState({ period, mag });
  }

  function renderExtras() {
    if (!extrasRoot) return;
    const periodSelect = extrasRoot.querySelector("[data-quake-period]");
    const magSelect = extrasRoot.querySelector("[data-quake-mag]");
    if (periodSelect) periodSelect.value = period;
    if (magSelect) magSelect.value = mag;
  }

  async function tick() {
    const id = ++requestId;
    try {
      const res = await fetch(feedUrl(mag, period), { cache: "no-store" });
      if (!res.ok) throw new Error(`USGS quakes HTTP ${res.status}`);
      const data = await res.json();
      if (id !== requestId) return;
      group.clearLayers();
      group.addData(oldestFirst(data));
      stackOldestBehind(group);
      count = (data.features || []).length;
      error = null;
    } catch (err) {
      if (id !== requestId) return;
      error = err.message || "USGS earthquakes unavailable";
    }
    onChange();
  }

  return {
    id: "earthquakes",
    name: "Earthquakes",
    description: "Size = magnitude · red = newest",
    color: "#f59e0b",
    defaultOn: false,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    mountExtras(container) {
      extrasRoot = container;
      container.innerHTML = `
        <label class="layer-select-row">
          Show
          <select class="layer-select" data-quake-period aria-label="Earthquake time window">
            ${USGS_QUAKE_PERIODS.map(
              (opt) =>
                `<option value="${opt.id}" ${opt.id === period ? "selected" : ""}>${opt.label}</option>`,
            ).join("")}
          </select>
        </label>
        <label class="layer-select-row">
          Magnitude
          <select class="layer-select" data-quake-mag aria-label="Minimum magnitude">
            ${USGS_QUAKE_MAGS.map(
              (opt) =>
                `<option value="${opt.id}" ${opt.id === mag ? "selected" : ""}>${opt.label}</option>`,
            ).join("")}
          </select>
        </label>
      `;
      container.querySelector("[data-quake-period]").addEventListener("change", (event) => {
        period = event.target.value;
        persist();
        tick();
      });
      container.querySelector("[data-quake-mag]").addEventListener("change", (event) => {
        mag = event.target.value;
        persist();
        tick();
      });
      renderExtras();
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, USGS_QUAKE_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
