import L from "leaflet";
import {
  STORAGE_KEY,
  WILDFIRE_AGE_OPTIONS,
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
  if (acres >= 10000) return 34;
  if (acres >= 1000) return 26;
  if (acres >= 100) return 20;
  return 16;
}

function parseFireTime(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) {
    return value < 1e12 ? value * 1000 : value;
  }
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

function fireStartedAt(props) {
  const raw = pick(props, ["FireDiscoveryDateTime", "CreateDate", "PolygonDateTime"]);
  const fromDate = parseFireTime(raw);
  if (fromDate != null) return fromDate;
  const ageDays = Number(pick(props, ["FireDiscoveryAge", "CreateDateAge"]));
  if (Number.isFinite(ageDays)) return Date.now() - ageDays * 24 * 60 * 60 * 1000;
  return null;
}

function filterByAge(data, hours) {
  if (!hours || !data?.features) return data;
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  return {
    ...data,
    features: data.features.filter((feature) => {
      const started = fireStartedAt(feature.properties || {});
      return started == null || started >= cutoff;
    }),
  };
}

function loadMaxAgeHours() {
  try {
    const n = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").wildfires?.maxAgeHours;
    return WILDFIRE_AGE_OPTIONS.some((opt) => opt.hours === n) ? n : 0;
  } catch {
    return 0;
  }
}

function saveMaxAgeHours(hours) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.wildfires = { ...(all.wildfires || {}), maxAgeHours: hours };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
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

function fireIcon(acres) {
  const size = markerSize(acres);
  const hot = acres >= 1000 ? "#ea580c" : "#f97316";
  return L.divIcon({
    className: "fire-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<svg class="fire-icon" viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <path fill="${hot}" stroke="#fff7ed" stroke-width="1.2"
        d="M12 2c0 4-3 5.5-3 9a3 3 0 0 0 6 0c0-2.5-1.5-4-1.5-6.5C14 7 16 9 16 12a4 4 0 0 1-8 0c0-2 1-3.5 2-5.5 0 3-2 4.5-2 8a6 6 0 0 0 12 0c0-4-2-6-2-10z"/>
    </svg>`,
  });
}

export function createWildfireLayer(map) {
  const incidents = L.geoJSON(null, {
    pointToLayer(feature, latlng) {
      const acres = acresOf(feature.properties || {});
      return L.marker(latlng, {
        icon: fireIcon(acres),
        zIndexOffset: 300,
      });
    },
    onEachFeature(feature, layer) {
      layer.bindPopup(firePopup(feature.properties || {}));
    },
  });

  const perimeters = L.geoJSON(null, {
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

  const group = L.layerGroup([perimeters, incidents]);
  let maxAgeHours = loadMaxAgeHours();
  let timer = null;
  let incidentData = null;
  let perimeterData = null;
  let count = 0;
  let error = null;
  let extrasRoot = null;
  let onChange = () => {};

  function applyData() {
    incidents.clearLayers();
    perimeters.clearLayers();
    let n = 0;
    if (incidentData) {
      const filtered = filterByAge(incidentData, maxAgeHours);
      incidents.addData(filtered);
      n += (filtered.features || []).length;
    }
    if (perimeterData) {
      const filtered = filterByAge(perimeterData, maxAgeHours);
      perimeters.addData(filtered);
      n += (filtered.features || []).length;
    }
    count = n;
  }

  function renderExtras() {
    if (!extrasRoot) return;
    const select = extrasRoot.querySelector("select");
    if (select) select.value = String(maxAgeHours);
  }

  async function tick() {
    const errors = [];
    try {
      incidentData = await fetchGeoJson(WILDFIRE_INCIDENT_URLS);
    } catch (err) {
      errors.push(err.message || "Wildfire feed unavailable");
    }
    try {
      perimeterData = await fetchGeoJson(WILDFIRE_PERIMETER_URL);
    } catch (err) {
      errors.push(err.message || "Perimeter feed unavailable");
    }
    error = incidentData || perimeterData ? null : errors[0] || "Wildfire feed unavailable";
    applyData();
    onChange();
  }

  return {
    id: "wildfires",
    name: "Wildfires",
    description: "Incidents and burn perimeters",
    color: "#f97316",
    defaultOn: true,
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
          <select class="layer-select" aria-label="Show fires from">
            ${WILDFIRE_AGE_OPTIONS.map(
              (opt) =>
                `<option value="${opt.hours}" ${opt.hours === maxAgeHours ? "selected" : ""}>${opt.label}</option>`,
            ).join("")}
          </select>
        </label>
      `;
      container.querySelector("select").addEventListener("change", (event) => {
        maxAgeHours = Number(event.target.value) || 0;
        saveMaxAgeHours(maxAgeHours);
        applyData();
        onChange();
      });
      renderExtras();
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
