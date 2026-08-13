import L from "leaflet";
import { AIRCRAFT_POLL_MS, AIRCRAFT_URL } from "../config.js";
import { iconSize, kindFor, svgMarkup } from "../aircraftIcons.js";
import {
  altitudeFt,
  colorForAircraft,
  isOnGround,
  legendStops,
} from "../altitudeColor.js";

function fmtAlt(ac) {
  if (isOnGround(ac)) return "Ground";
  const alt = altitudeFt(ac);
  if (typeof alt === "number") return `${alt.toLocaleString()} ft`;
  return "—";
}

function popupHtml(ac) {
  const flight = (ac.flight || "Unknown").trim();
  const type = ac.t || ac.desc || "Unknown aircraft";
  const speed = typeof ac.gs === "number" ? `${Math.round(ac.gs)} kts` : "—";
  const track = typeof ac.track === "number" ? `${Math.round(ac.track)}°` : "—";
  const route =
    ac.route_from && ac.route_to
      ? `<div class="popup-row">${ac.route_from} → ${ac.route_to}</div>`
      : "";
  return `
    <div class="popup-kicker">Aircraft</div>
    <div class="popup-title">${flight}</div>
    <div class="popup-row">${type}</div>
    ${route}
    <div class="popup-row">Alt ${fmtAlt(ac)} · ${speed} · hdg ${track}</div>
  `;
}

function makeIcon(ac, showLabel) {
  const onGround = isOnGround(ac);
  const kind = kindFor(ac, onGround);
  const color = colorForAircraft(ac);
  const track = typeof ac.track === "number" ? ac.track : 0;
  const size = iconSize(kind);
  const flight = showLabel && ac.flight ? ac.flight.trim() : "";
  const label = flight ? `<span class="ac-label">${flight}</span>` : "";
  return L.divIcon({
    className: "ac-icon",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div class="ac-rot">${svgMarkup(kind, color, track)}</div>${label}`,
  });
}

function ensureLegend() {
  if (document.getElementById("alt-legend")) return;
  const el = document.createElement("div");
  el.id = "alt-legend";
  el.className = "alt-legend";
  el.innerHTML = `
    <div class="alt-bar" style="background:linear-gradient(to top, ${legendStops().join(", ")})"></div>
    <div class="alt-labels">
      <span>FL400</span>
      <span>FL200</span>
      <span>10k</span>
      <span>GND</span>
    </div>
  `;
  document.body.appendChild(el);
}

export function createAircraftLayer(map) {
  const group = L.layerGroup();
  const markers = new Map();
  const routes = L.layerGroup();
  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};

  function showLabels() {
    return map.getZoom() >= 9;
  }

  function sync(aircraft) {
    const seen = new Set();
    const labels = showLabels();

    for (const ac of aircraft) {
      if (typeof ac.lat !== "number" || typeof ac.lon !== "number" || !ac.hex) continue;
      seen.add(ac.hex);
      const existing = markers.get(ac.hex);
      const icon = makeIcon(ac, labels);
      if (existing) {
        existing.setLatLng([ac.lat, ac.lon]);
        existing.setIcon(icon);
        existing.setPopupContent(popupHtml(ac));
        existing._hub = ac;
      } else {
        const marker = L.marker([ac.lat, ac.lon], { icon, zIndexOffset: 400 })
          .bindPopup(popupHtml(ac));
        marker._hub = ac;
        marker.on("click", () => drawRoute(ac));
        marker.addTo(group);
        markers.set(ac.hex, marker);
      }
    }

    for (const [hex, marker] of markers) {
      if (!seen.has(hex)) {
        group.removeLayer(marker);
        markers.delete(hex);
      }
    }

    count = seen.size;
  }

  function drawRoute(ac) {
    routes.clearLayers();
    if (!ac.route_from_lat || !ac.route_to_lat) return;
    L.polyline(
      [
        [ac.route_from_lat, ac.route_from_lon],
        [ac.lat, ac.lon],
        [ac.route_to_lat, ac.route_to_lon],
      ],
      { color: "#94a3b8", weight: 2, dashArray: "6 8", opacity: 0.7 },
    ).addTo(routes);
    L.circleMarker([ac.route_from_lat, ac.route_from_lon], {
      radius: 4,
      color: "#22c55e",
      fillColor: "#22c55e",
      fillOpacity: 1,
    }).addTo(routes);
    L.circleMarker([ac.route_to_lat, ac.route_to_lon], {
      radius: 4,
      color: "#ef4444",
      fillColor: "#ef4444",
      fillOpacity: 1,
    }).addTo(routes);
    if (map.hasLayer(group)) routes.addTo(map);
  }

  async function tick() {
    try {
      const res = await fetch(AIRCRAFT_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Aircraft HTTP ${res.status}`);
      const data = await res.json();
      sync(data.aircraft || []);
      error = null;
    } catch (err) {
      error = err.message || "Aircraft feed unavailable";
    }
    onChange();
  }

  map.on("zoomend", () => {
    if (!map.hasLayer(group)) return;
    for (const marker of markers.values()) {
      marker.setIcon(makeIcon(marker._hub, showLabels()));
    }
  });

  return {
    id: "aircraft",
    name: "Aircraft",
    description: "Live ADS-B · shape by type, color by altitude",
    color: "#38bdf8",
    defaultOn: true,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    enable() {
      ensureLegend();
      document.getElementById("alt-legend").hidden = false;
      group.addTo(map);
      tick();
      timer = setInterval(tick, AIRCRAFT_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
      map.removeLayer(routes);
      routes.clearLayers();
      const legend = document.getElementById("alt-legend");
      if (legend) legend.hidden = true;
    },
  };
}
