import L from "leaflet";
import { HAZARD_POLL_MS, LSR_URL } from "../config.js";

function colorOf(type = "") {
  const t = type.toLowerCase();
  if (t.includes("tornado")) return "#ef4444";
  if (t.includes("hail")) return "#22c55e";
  if (t.includes("wind") || t.includes("tstm")) return "#eab308";
  if (t.includes("flood")) return "#38bdf8";
  if (t.includes("rain")) return "#818cf8";
  return "#cbd5e1";
}

function popup(p) {
  return `
    <div class="popup-kicker">Local storm report</div>
    <div class="popup-title">${p.typetext || p.type || "Report"}</div>
    <div class="popup-row">${p.magnitude ? `${p.magnitude} · ` : ""}${p.city || p.county || ""} ${p.state || ""}</div>
    <div class="popup-row">${p.valid || p.utc_valid || ""}</div>
    ${p.remark ? `<div class="popup-row">${p.remark}</div>` : ""}
  `;
}

export function createLsrLayer(map) {
  const group = L.geoJSON(null, {
    pointToLayer(feature, latlng) {
      const c = colorOf(feature.properties?.typetext || feature.properties?.type);
      return L.circleMarker(latlng, {
        radius: 5,
        color: c,
        fillColor: c,
        fillOpacity: 0.9,
        weight: 1,
      });
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
      const res = await fetch(LSR_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`LSR HTTP ${res.status}`);
      const data = await res.json();
      group.clearLayers();
      group.addData(data);
      count = (data.features || []).length;
      error = null;
    } catch (err) {
      error = err.message || "Storm reports unavailable";
    }
    onChange();
  }

  return {
    id: "lsr",
    name: "Storm reports",
    description: "NWS local storm reports · 12 hours",
    color: "#eab308",
    defaultOn: false,
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
