import L from "leaflet";
import { HAZARD_POLL_MS, STORM_ATTR_URL } from "../config.js";

function destPoint(lat, lon, bearingDeg, distNm) {
  const R = 3440.065;
  const brng = (bearingDeg * Math.PI) / 180;
  const lat1 = (lat * Math.PI) / 180;
  const lon1 = (lon * Math.PI) / 180;
  const d = distNm / R;
  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2),
    );
  return [lat2 * (180 / Math.PI), lon2 * (180 / Math.PI)];
}

function stormColor(p) {
  if (p.tvs && p.tvs !== "NONE") return "#f472b6";
  if (p.meso && p.meso !== "NONE") return "#f97316";
  if ((p.posh || 0) >= 50) return "#eab308";
  if ((p.max_dbz || 0) >= 50) return "#38bdf8";
  return "#94a3b8";
}

function popup(p) {
  return `
    <div class="popup-kicker">${p.nexrad || "NEXRAD"} · ${p.storm_id || ""}</div>
    <div class="popup-title">Storm cell</div>
    <div class="popup-row">${Math.round(p.max_dbz || 0)} dBZ · top ${p.top ?? "—"} kft · VIL ${p.vil ?? "—"}</div>
    <div class="popup-row">Motion ${p.drct ?? "—"}° at ${p.sknt ?? "—"} kt</div>
    <div class="popup-row">Hail POSH ${p.posh ?? 0}% · size ${p.max_size ?? 0}"</div>
    <div class="popup-row">TVS ${p.tvs || "NONE"} · MESO ${p.meso || "NONE"}</div>
  `;
}

export function createStormTracksLayer(map, { getRadarIds } = {}) {
  const group = L.layerGroup();
  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};

  function draw(features) {
    group.clearLayers();
    const allow = new Set((getRadarIds?.() || []).map((id) => String(id).toUpperCase()));
    let n = 0;
    for (const feature of features) {
      const p = feature.properties || {};
      const site = String(p.nexrad || "").toUpperCase();
      if (allow.size && !allow.has(site)) continue;
      const coords = feature.geometry?.coordinates;
      if (!coords) continue;
      const lat = coords[1];
      const lon = coords[0];
      const color = stormColor(p);
      const marker = L.circleMarker([lat, lon], {
        radius: p.tvs && p.tvs !== "NONE" ? 7 : 5,
        color,
        fillColor: color,
        fillOpacity: 0.95,
        weight: 2,
      }).bindPopup(popup(p));
      marker.addTo(group);

      const sknt = Number(p.sknt) || 0;
      const drct = Number(p.drct);
      if (sknt > 0 && Number.isFinite(drct)) {
        const pts = [[lat, lon]];
        for (const min of [15, 30, 45]) {
          pts.push(destPoint(lat, lon, drct, sknt * (min / 60)));
        }
        L.polyline(pts, { color, weight: 2, opacity: 0.85 }).addTo(group);
        for (let i = 1; i < pts.length; i++) {
          L.circleMarker(pts[i], {
            radius: 2,
            color,
            fillColor: "#0f172a",
            fillOpacity: 1,
            weight: 1,
          }).addTo(group);
        }
      }
      n += 1;
    }
    count = n;
  }

  async function tick() {
    try {
      const res = await fetch(STORM_ATTR_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`Storm tracks HTTP ${res.status}`);
      const data = await res.json();
      draw(data.features || []);
      error = null;
    } catch (err) {
      error = err.message || "Storm tracks unavailable";
    }
    onChange();
  }

  return {
    id: "storms",
    name: "Storm tracks",
    description: "NWS SCIT cells for selected radars",
    color: "#f472b6",
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
