import L from "leaflet";
import { AIR_POLL_MS, AIRNOW_URL, SMOKE_URL, STORAGE_KEY } from "../config.js";
import { esc } from "../html.js";

const AQI = {
  1: { label: "Good", color: "#00e400" },
  2: { label: "Moderate", color: "#ffff00" },
  3: { label: "USG", color: "#ff7e00" },
  4: { label: "Unhealthy", color: "#ff0000" },
  5: { label: "Very unhealthy", color: "#8f3f97" },
  6: { label: "Hazardous", color: "#7e0023" },
};

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").airquality || {};
  } catch {
    return {};
  }
}

function saveState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.airquality = { ...(all.airquality || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function smokeColor(desc) {
  const n = Number(String(desc || "").split(/[-–]/).pop());
  if (!Number.isFinite(n) || n <= 3) return "#fde68a";
  if (n <= 10) return "#fbbf24";
  if (n <= 20) return "#f97316";
  if (n <= 30) return "#b91c1c";
  return "#7f1d1d";
}

export function createAirQualityLayer(map) {
  const saved = loadState();
  let mode = saved.mode === "smoke" ? "smoke" : "aqi";
  let extrasRoot = null;
  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};
  let requestId = 0;

  const group = L.geoJSON(null, {
    style(feature) {
      const p = feature.properties || {};
      if (p.gridcode != null) {
        const c = AQI[p.gridcode]?.color || "#94a3b8";
        return { color: c, weight: 1, fillColor: c, fillOpacity: 0.32 };
      }
      const c = smokeColor(p.smoke_classdesc);
      return { color: c, weight: 1, fillColor: c, fillOpacity: 0.28 };
    },
    onEachFeature(feature, layer) {
      const p = feature.properties || {};
      if (p.gridcode != null) {
        const aqi = AQI[p.gridcode] || { label: `AQI ${p.gridcode}` };
        layer.bindPopup(`
          <div class="popup-kicker">AirNow</div>
          <div class="popup-title">${esc(aqi.label)}</div>
          ${p.Timestamp ? `<div class="popup-row">${esc(p.Timestamp)}</div>` : ""}
        `);
        return;
      }
      layer.bindPopup(`
        <div class="popup-kicker">Smoke forecast</div>
        <div class="popup-title">${esc(p.smoke_classdesc || "Smoke")} µg/m³</div>
      `);
    },
  });

  function persist() {
    saveState({ mode });
  }

  function renderExtras() {
    if (!extrasRoot) return;
    extrasRoot.querySelectorAll("[data-air]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.air === mode);
    });
  }

  async function tick() {
    const id = ++requestId;
    try {
      const url = mode === "smoke" ? SMOKE_URL : AIRNOW_URL;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`Air quality HTTP ${res.status}`);
      const data = await res.json();
      if (id !== requestId) return;
      const features = data.features || [];
      let next = data;
      if (mode === "smoke") {
        let max = 0;
        for (const feature of features) {
          const t = Number(feature.properties?.referencedate);
          if (t > max) max = t;
        }
        next = max
          ? { ...data, features: features.filter((f) => Number(f.properties?.referencedate) === max) }
          : data;
      }
      group.clearLayers();
      group.addData(next);
      count = (next.features || []).length;
      error = null;
    } catch (err) {
      if (id !== requestId) return;
      error = err.message || "Air quality unavailable";
    }
    onChange();
  }

  return {
    id: "airquality",
    name: "Air quality",
    description: "AirNow AQI · NOAA smoke forecast",
    color: "#a3e635",
    defaultOn: false,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    mountExtras(container) {
      extrasRoot = container;
      container.innerHTML = `
        <div class="meso-vars">
          <button type="button" class="meso-chip" data-air="aqi">AQI</button>
          <button type="button" class="meso-chip" data-air="smoke">Smoke</button>
        </div>
      `;
      container.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-air]");
        if (!btn || btn.dataset.air === mode) return;
        mode = btn.dataset.air;
        persist();
        renderExtras();
        tick();
      });
      renderExtras();
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, AIR_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
