import L from "leaflet";
import {
  MRMS_PERIODS,
  MRMS_REFRESH_MS,
  MRMS_TILE_BASE,
  STORAGE_KEY,
} from "../config.js";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").rainfall || {};
  } catch {
    return {};
  }
}

function saveState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.rainfall = { ...(all.rainfall || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

export function createRainfallLayer(map) {
  const saved = loadState();
  let period = MRMS_PERIODS.some((p) => p.id === saved.period)
    ? saved.period
    : "q2-p24h";
  let opacity = saved.opacity ?? 0.65;
  let extrasRoot = null;
  let layer = null;
  let timer = null;
  let bust = Date.now();
  let enabled = false;
  let error = null;
  let onChange = () => {};

  function persist() {
    saveState({ period, opacity });
  }

  function tileUrl() {
    return `${MRMS_TILE_BASE}/${period}/{z}/{x}/{y}.png?v=${bust}`;
  }

  function ensureLayer() {
    if (layer) {
      layer.setUrl(tileUrl());
      layer.setOpacity(opacity);
      return;
    }
    layer = L.tileLayer(tileUrl(), {
      opacity,
      pane: "overlayPane",
      className: "mrms-tiles",
      attribution: "MRMS QPE © Iowa Environmental Mesonet / NSSL",
      maxZoom: 16,
      noWrap: true,
    });
    layer.addTo(map);
  }

  function refresh() {
    bust = Date.now();
    if (layer) layer.setUrl(tileUrl());
  }

  function setPeriod(next) {
    if (period === next) return;
    period = next;
    persist();
    if (enabled) {
      if (layer) {
        map.removeLayer(layer);
        layer = null;
      }
      ensureLayer();
    }
    renderExtras();
    onChange();
  }

  function renderExtras() {
    if (!extrasRoot) return;
    extrasRoot.querySelectorAll("[data-period]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.period === period);
    });
  }

  return {
    id: "rainfall",
    name: "Rainfall",
    description: "MRMS estimated accumulation",
    color: "#6366f1",
    defaultOn: false,
    hasOpacity: true,
    getOpacity: () => opacity,
    getCount: () => null,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    setOpacity(value) {
      opacity = value;
      persist();
      if (layer) layer.setOpacity(opacity);
    },
    mountExtras(container) {
      extrasRoot = container;
      container.innerHTML = `
        <div class="meso-vars">
          ${MRMS_PERIODS.map(
            (p) =>
              `<button type="button" class="meso-chip" data-period="${p.id}">${p.label}</button>`,
          ).join("")}
        </div>
      `;
      container.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-period]");
        if (btn) setPeriod(btn.dataset.period);
      });
      renderExtras();
    },
    enable() {
      enabled = true;
      try {
        ensureLayer();
        error = null;
      } catch (err) {
        error = err.message || "Rainfall tiles unavailable";
      }
      timer = setInterval(refresh, MRMS_REFRESH_MS);
      onChange();
    },
    disable() {
      enabled = false;
      clearInterval(timer);
      timer = null;
      if (layer) {
        map.removeLayer(layer);
        layer = null;
      }
    },
  };
}
