import L from "leaflet";
import {
  WILDFIRE_INCIDENT_URLS,
  WILDFIRE_PERIMETER_URL,
  WILDFIRE_POLL_MS,
} from "../config.js";

function pick(props, keys) {
  for (const key of keys) {
    if (props[key] != null && props[key] !== "") return props[key];
  }
  return null;
}

function acresOf(props) {
  const value = pick(props, ["DailyAcres", "CalculatedAcres", "DiscoveryAcres", "GISAcres", "IncidentSize", "acres", "Acres"]);
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fmtAcres(n) {
  if (!n) return "—";
  return `${Math.round(n).toLocaleString()} acres`;
}

function firePopup(props) {
  const name = pick(props, ["IncidentName", "incident_name", "Name", "FIRE_NAME"]) || "Wildfire";
  const state = pick(props, ["POOState", "state", "STATE"]);
  const county = pick(props, ["POOCounty", "county"]);
  const contained = pick(props, ["PercentContained", "percent_contained"]);
  const cause = pick(props, ["FireCause", "FireCauseGeneral"]);
  const age = pick(props, ["FireDiscoveryAge"]);
  const type = pick(props, ["IncidentTypeCategory", "FeatureCategory"]);
  const loc = [county, state].filter(Boolean).join(", ");
  return `
    <div class="popup-kicker">${type || "Wildfire"}</div>
    <div class="popup-title">${name}</div>
    ${loc ? `<div class="popup-row">${loc}</div>` : ""}
    <div class="popup-row">${fmtAcres(acresOf(props))}${contained != null ? ` · ${contained}% contained` : ""}</div>
    ${cause ? `<div class="popup-row">Cause: ${cause}</div>` : ""}
    ${age != null ? `<div class="popup-row">Discovered ${age} day${age === 1 ? "" : "s"} ago</div>` : ""}
  `;
}

function markerSize(acres) {
  if (acres >= 10000) return 22;
  if (acres >= 1000) return 16;
  if (acres >= 100) return 12;
  return 9;
}

async function fetchGeoJson(urls) {
  const list = Array.isArray(urls) ? urls : [urls];
  let lastError = null;
  for (const url of list) {
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastError = `HTTP ${res.status}`;
        continue;
      }
      const data = await res.json();
      if (data?.error) {
        lastError = data.error.message || "Invalid wildfire service";
        continue;
      }
      if (data?.type === "FeatureCollection") return data;
      lastError = "Unexpected wildfire payload";
    } catch (err) {
      lastError = err.message;
    }
  }
  throw new Error(lastError || "Wildfire feed unavailable");
}

export function createWildfireIncidentsLayer(map) {
  const group = L.geoJSON(null, {
    pointToLayer(feature, latlng) {
      const acres = acresOf(feature.properties || {});
      const size = markerSize(acres);
      return L.marker(latlng, {
        icon: L.divIcon({
          className: "fire-marker",
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          html: `<div class="fire-dot" style="background:${acres >= 1000 ? "#ea580c" : "#f97316"}"></div>`,
        }),
        zIndexOffset: 300,
      });
    },
    onEachFeature(feature, layer) {
      layer.bindPopup(firePopup(feature.properties || {}));
    },
  });

  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};

  async function tick() {
    try {
      const data = await fetchGeoJson(WILDFIRE_INCIDENT_URLS);
      group.clearLayers();
      group.addData(data);
      count = (data.features || []).length;
      error = null;
    } catch (err) {
      error = err.message || "Wildfire feed unavailable";
    }
    onChange();
  }

  return {
    id: "wildfires",
    name: "Wildfires",
    description: "Current incidents",
    color: "#f97316",
    defaultOn: true,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, WILDFIRE_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}

export function createWildfirePerimetersLayer(map) {
  const group = L.geoJSON(null, {
    style(feature) {
      const category = pick(feature.properties || {}, ["FeatureCategory", "IncidentTypeCategory"]) || "";
      const prescribed = /prescrib/i.test(category) || category === "RX";
      return {
        color: prescribed ? "#eab308" : "#ef4444",
        weight: 2,
        fillColor: prescribed ? "#eab308" : "#f97316",
        fillOpacity: 0.28,
      };
    },
    onEachFeature(feature, layer) {
      layer.bindPopup(firePopup(feature.properties || {}));
    },
  });

  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};

  async function tick() {
    try {
      const data = await fetchGeoJson(WILDFIRE_PERIMETER_URL);
      group.clearLayers();
      group.addData(data);
      count = (data.features || []).length;
      error = null;
    } catch (err) {
      error = err.message || "Perimeter feed unavailable";
    }
    onChange();
  }

  return {
    id: "perimeters",
    name: "Fire perimeters",
    description: "Mapped burn outlines",
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
      timer = setInterval(tick, WILDFIRE_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
