import L from "leaflet";
import { SPC_OUTLOOK_BASE, SPC_OUTLOOK_DAYS, SPC_POLL_MS, STORAGE_KEY } from "../config.js";
import { esc } from "../html.js";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").outlooks || {};
  } catch {
    return {};
  }
}

function saveState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.outlooks = { ...(all.outlooks || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function fmtStamp(value) {
  const s = String(value || "");
  if (s.length < 12) return s;
  const d = new Date(
    Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)), Number(s.slice(8, 10)), Number(s.slice(10, 12))),
  );
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleString(undefined, {
    hour: "numeric",
    month: "short",
    day: "numeric",
    timeZoneName: "short",
  });
}

function popup(props) {
  return `
    <div class="popup-kicker">SPC outlook</div>
    <div class="popup-title">${esc(props.label2 || props.label || "Outlook")}</div>
    <div class="popup-row">Valid ${esc(fmtStamp(props.valid))} · until ${esc(fmtStamp(props.expire))}</div>
  `;
}

export function createOutlooksLayer(map) {
  const saved = loadState();
  let day = SPC_OUTLOOK_DAYS.some((d) => d.id === saved.day) ? saved.day : "1";
  let extrasRoot = null;
  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};
  let requestId = 0;

  const group = L.geoJSON(null, {
    style(feature) {
      const p = feature.properties || {};
      return {
        color: p.stroke || "#94a3b8",
        weight: 2,
        fillColor: p.fill || p.stroke || "#94a3b8",
        fillOpacity: 0.2,
      };
    },
    onEachFeature(feature, layer) {
      layer.bindPopup(popup(feature.properties || {}));
    },
  });

  function persist() {
    saveState({ day });
  }

  function renderExtras() {
    if (!extrasRoot) return;
    extrasRoot.querySelectorAll("[data-day]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.day === day);
    });
  }

  function layerId() {
    return SPC_OUTLOOK_DAYS.find((d) => d.id === day)?.layer ?? 1;
  }

  async function tick() {
    const id = ++requestId;
    try {
      const url = `${SPC_OUTLOOK_BASE}/${layerId()}/query?where=1%3D1&outFields=label,label2,dn,valid,expire,stroke,fill&outSR=4326&f=geojson`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`SPC outlook HTTP ${res.status}`);
      const data = await res.json();
      if (id !== requestId) return;
      group.clearLayers();
      group.addData(data);
      count = (data.features || []).length;
      error = null;
    } catch (err) {
      if (id !== requestId) return;
      error = err.message || "SPC outlooks unavailable";
    }
    onChange();
  }

  return {
    id: "outlooks",
    name: "SPC outlook",
    description: "Categorical convective risk",
    color: "#eab308",
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
          ${SPC_OUTLOOK_DAYS.map(
            (d) => `<button type="button" class="meso-chip" data-day="${d.id}">${d.label}</button>`,
          ).join("")}
        </div>
      `;
      container.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-day]");
        if (!btn || btn.dataset.day === day) return;
        day = btn.dataset.day;
        persist();
        renderExtras();
        tick();
      });
      renderExtras();
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, SPC_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
