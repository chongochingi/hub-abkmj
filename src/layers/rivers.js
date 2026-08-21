import L from "leaflet";
import { DEFAULT_LAKE_STATE, RIVERS_POLL_MS, RIVERS_URL, STORAGE_KEY, US_STATES } from "../config.js";
import { esc } from "../html.js";

const STATUS_COLOR = {
  major: "#9f1239",
  moderate: "#ea580c",
  minor: "#ca8a04",
  action: "#16a34a",
  no_flooding: "#38bdf8",
  not_defined: "#94a3b8",
  obs_not_current: "#64748b",
};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").rivers || {};
  } catch {
    return {};
  }
}

function saveState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.rivers = { ...(all.rivers || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function isFlooding(status) {
  return /action|minor|moderate|major|record/i.test(status || "");
}

function statusLabel(status) {
  return String(status || "unknown").replaceAll("_", " ");
}

function popupHtml(p) {
  const flood = p.flood ? ` · flood ${esc(p.flood)} ${esc(p.units || "ft")}` : "";
  return `
    <div class="popup-kicker">River gauge · ${esc(statusLabel(p.status))}</div>
    <div class="popup-title">${esc(p.location || p.gaugelid || "Gauge")}</div>
    <div class="popup-row">${esc(p.waterbody || "")}</div>
    <div class="popup-row">Stage ${esc(p.observed || "—")} ${esc(p.units || "ft")}${flood}</div>
    ${p.obstime ? `<div class="popup-row">${esc(p.obstime)}</div>` : ""}
    ${p.url ? `<div class="popup-row"><a href="${esc(p.url)}" target="_blank" rel="noreferrer">NWPS gauge page</a></div>` : ""}
  `;
}

function radius(status) {
  if (/major|record/i.test(status)) return 8;
  if (/moderate/i.test(status)) return 7;
  if (/minor|action/i.test(status)) return 6;
  return 4;
}

export function createRiversLayer(map) {
  const saved = loadState();
  let stateCd = US_STATES.some((s) => s.id === saved.state) ? saved.state : DEFAULT_LAKE_STATE;
  let floodingOnly = Boolean(saved.floodingOnly);
  let extrasRoot = null;
  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};
  let requestId = 0;
  let features = [];

  const group = L.layerGroup();

  function persist() {
    saveState({ state: stateCd, floodingOnly });
  }

  function colorOf(status) {
    const key = String(status || "").toLowerCase();
    return STATUS_COLOR[key] || "#94a3b8";
  }

  function draw() {
    group.clearLayers();
    const rows = floodingOnly ? features.filter((f) => isFlooding(f.properties?.status)) : features;
    for (const feature of rows) {
      const p = feature.properties || {};
      const coords = feature.geometry?.coordinates;
      if (!coords) continue;
      const c = colorOf(p.status);
      const marker = L.circleMarker([coords[1], coords[0]], {
        radius: radius(p.status),
        color: c,
        fillColor: c,
        fillOpacity: 0.85,
        weight: 1,
      }).bindPopup(popupHtml(p));
      marker.addTo(group);
    }
    count = rows.length;
  }

  function renderExtras() {
    if (!extrasRoot) return;
    const select = extrasRoot.querySelector("[data-river-state]");
    const check = extrasRoot.querySelector("[data-river-flood]");
    if (select) select.value = stateCd;
    if (check) check.checked = floodingOnly;
  }

  async function tick() {
    const id = ++requestId;
    try {
      const where = encodeURIComponent(`state='${stateCd.toUpperCase()}'`);
      const url = `${RIVERS_URL}?where=${where}&outFields=gaugelid,location,observed,status,units,state,url,waterbody,obstime,flood&outSR=4326&f=geojson&resultRecordCount=10000`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`River gauges HTTP ${res.status}`);
      const data = await res.json();
      if (id !== requestId) return;
      features = data.features || [];
      draw();
      error = null;
    } catch (err) {
      if (id !== requestId) return;
      error = err.message || "River gauges unavailable";
    }
    onChange();
  }

  return {
    id: "rivers",
    name: "River gauges",
    description: "NWS stage · color = flood status",
    color: "#0ea5e9",
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
          State
          <select class="layer-select" data-river-state aria-label="River gauge state">
            ${US_STATES.map(
              (opt) =>
                `<option value="${opt.id}" ${opt.id === stateCd ? "selected" : ""}>${opt.label}</option>`,
            ).join("")}
          </select>
        </label>
        <label class="check-row">
          <input type="checkbox" data-river-flood ${floodingOnly ? "checked" : ""} />
          Flooding only
        </label>
      `;
      container.querySelector("[data-river-state]").addEventListener("change", (event) => {
        stateCd = event.target.value;
        persist();
        tick();
      });
      container.querySelector("[data-river-flood]").addEventListener("change", (event) => {
        floodingOnly = event.target.checked;
        persist();
        draw();
        onChange();
      });
      renderExtras();
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, RIVERS_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
