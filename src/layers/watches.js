import L from "leaflet";
import { HAZARD_POLL_MS, WATCHES_URL } from "../config.js";

function colorOf(event = "") {
  if (/tornado/i.test(event)) return "#7f1d1d";
  if (/thunder/i.test(event)) return "#a16207";
  if (/flood/i.test(event)) return "#166534";
  return "#6b21a8";
}

function popup(props) {
  return `
    <div class="popup-kicker">${props.senderName || "NWS"}</div>
    <div class="popup-title">${props.event || "Watch"}</div>
    <div class="popup-row">${props.areaDesc || ""}</div>
    <div class="popup-row">Until ${props.ends || props.expires || "—"}</div>
    ${props.headline ? `<div class="popup-row">${props.headline}</div>` : ""}
  `;
}

export function createWatchesLayer(map) {
  const group = L.geoJSON(null, {
    style(feature) {
      const c = colorOf(feature.properties?.event);
      return { color: c, weight: 3, dashArray: "6 4", fillColor: c, fillOpacity: 0.12 };
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
      const res = await fetch(WATCHES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Watches HTTP ${res.status}`);
      const data = await res.json();
      const withGeom = {
        ...data,
        features: (data.features || []).filter((f) => f.geometry),
      };
      group.clearLayers();
      group.addData(withGeom);
      count = withGeom.features.length;
      error = null;
    } catch (err) {
      error = err.message || "Watches unavailable";
    }
    onChange();
  }

  return {
    id: "watches",
    name: "Watches",
    description: "SPC / NWS tornado & severe watches",
    color: "#a16207",
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
