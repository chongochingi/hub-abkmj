import L from "leaflet";
import { HAZARD_POLL_MS, WARNINGS_URL } from "../config.js";

const COLORS = {
  TO: "#ef4444",
  SV: "#f59e0b",
  FF: "#22c55e",
  FA: "#34d399",
  FL: "#2dd4bf",
  MA: "#38bdf8",
};

const NAMES = {
  TO: "Tornado Warning",
  SV: "Severe Thunderstorm Warning",
  FF: "Flash Flood Warning",
  FA: "Flood Watch/Advisory",
  FL: "Flood Warning",
  MA: "Marine Warning",
};

function colorOf(code) {
  return COLORS[code] || "#a78bfa";
}

function popup(props) {
  const code = props.phenomena || "";
  const title = NAMES[code] || props.ps || "Warning";
  const tags = [
    props.tornadotag && `Tornado: ${props.tornadotag}`,
    props.damagetag && `Damage: ${props.damagetag}`,
    props.hailtag && `Hail: ${props.hailtag}`,
    props.windtag && `Wind: ${props.windtag}`,
  ].filter(Boolean);
  return `
    <div class="popup-kicker">${props.wfo || "NWS"}</div>
    <div class="popup-title">${title}</div>
    <div class="popup-row">${props.is_emergency ? "EMERGENCY · " : ""}${props.is_pds ? "PDS · " : ""}Until ${props.expire || props.expire_utc || "—"}</div>
    ${tags.map((t) => `<div class="popup-row">${t}</div>`).join("")}
  `;
}

export function createWarningsLayer(map) {
  const group = L.geoJSON(null, {
    style(feature) {
      const c = colorOf(feature.properties?.phenomena);
      return { color: c, weight: 3, fillColor: c, fillOpacity: 0.18 };
    },
    onEachFeature(feature, layer) {
      layer.bindPopup(popup(feature.properties || {}));
    },
  });

  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};

  async function tick() {
    try {
      const res = await fetch(WARNINGS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Warnings HTTP ${res.status}`);
      const data = await res.json();
      group.clearLayers();
      group.addData(data);
      count = (data.features || []).length;
      error = null;
    } catch (err) {
      error = err.message || "Warnings unavailable";
    }
    onChange();
  }

  return {
    id: "warnings",
    name: "Warnings",
    description: "NWS tornado, severe, flash flood",
    color: "#ef4444",
    defaultOn: true,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, HAZARD_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
