import L from "leaflet";
import { METAR_MIN_ZOOM, METAR_POLL_MS, METAR_URL } from "../config.js";
import { esc } from "../html.js";
import { attachSoundingPopup } from "../sounding.js";

const CAT_COLOR = {
  VFR: "#22c55e",
  MVFR: "#38bdf8",
  IFR: "#f97316",
  LIFR: "#a855f7",
};

function cToF(c) {
  return c == null ? null : c * 1.8 + 32;
}

function fmtWhen(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function popupHtml(p) {
  const tempF = cToF(p.temp);
  const dewF = cToF(p.dewp);
  const wind =
    p.wspd != null
      ? `${p.wdir ?? "VRB"}° ${p.wspd} kt${p.wgst != null ? ` · gust ${p.wgst}` : ""}`
      : "—";
  return `
    <div class="popup-kicker">METAR · ${esc(p.fltcat || "")}</div>
    <div class="popup-title">${esc(p.id || "Station")}</div>
    <div class="popup-row">${esc(p.site || "")}</div>
    <div class="popup-row">${esc(fmtWhen(p.obsTime))}</div>
    <div class="popup-row">Temp ${tempF == null ? "—" : `${Math.round(tempF)}°F`} · Dew ${dewF == null ? "—" : `${Math.round(dewF)}°F`}</div>
    <div class="popup-row">Wind ${esc(wind)}</div>
    <div class="popup-row">Vis ${esc(p.visib ?? "—")} SM · cover ${esc(p.cover || "—")}${p.ceil != null ? ` · ceil ${Number(p.ceil) * 100} ft` : ""}</div>
    ${p.rawOb ? `<div class="popup-row popup-raw">${esc(p.rawOb)}</div>` : ""}
    <div data-sounding></div>
  `;
}

function makeIcon(p, labeled) {
  const color = CAT_COLOR[p.fltcat] || "#94a3b8";
  const text = p.temp == null ? "—" : `${Math.round(cToF(p.temp))}°`;
  return L.divIcon({
    className: "meso-marker",
    iconSize: [36, 18],
    iconAnchor: [18, 9],
    html: `<div class="meso-pill" style="background:${color}">${labeled ? text : ""}</div>`,
  });
}

export function createMetarLayer(map) {
  const group = L.layerGroup();
  const markers = new Map();
  let timer = null;
  let moveTimer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};
  let requestId = 0;
  let enabled = false;

  function labeled() {
    return map.getZoom() >= 8;
  }

  function bboxParam() {
    const b = map.getBounds().pad(0.12);
    return [b.getSouth(), b.getWest(), b.getNorth(), b.getEast()]
      .map((n) => n.toFixed(3))
      .join(",");
  }

  function sync(features) {
    const seen = new Set();
    const show = labeled();
    for (const feature of features) {
      const p = feature.properties || {};
      const id = p.id;
      const coords = feature.geometry?.coordinates;
      if (!id || !coords) continue;
      seen.add(id);
      const latlng = [coords[1], coords[0]];
      const icon = makeIcon(p, show);
      const existing = markers.get(id);
      if (existing) {
        existing.setLatLng(latlng);
        existing.setIcon(icon);
        existing.setPopupContent(popupHtml(p));
        existing._hub = p;
        continue;
      }
      const marker = L.marker(latlng, { icon, zIndexOffset: 240 }).bindPopup(popupHtml(p), {
        maxWidth: 320,
      });
      marker._hub = p;
      attachSoundingPopup(marker, () => ({
        lat: marker.getLatLng().lat,
        lon: marker.getLatLng().lng,
        stationId: marker._hub?.id,
      }));
      marker.addTo(group);
      markers.set(id, marker);
    }
    for (const [id, marker] of markers) {
      if (seen.has(id)) continue;
      group.removeLayer(marker);
      markers.delete(id);
    }
    count = seen.size;
  }

  async function tick() {
    if (!enabled) return;
    if (map.getZoom() < METAR_MIN_ZOOM) {
      sync([]);
      error = "Zoom in for METARs";
      onChange();
      return;
    }
    const id = ++requestId;
    try {
      const url = `${METAR_URL}?format=geojson&hours=2&bbox=${bboxParam()}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`METAR HTTP ${res.status}`);
      const data = await res.json();
      if (id !== requestId) return;
      sync(data.features || []);
      error = null;
    } catch (err) {
      if (id !== requestId) return;
      error = err.message || "METARs unavailable";
    }
    onChange();
  }

  function onMove() {
    clearTimeout(moveTimer);
    moveTimer = setTimeout(tick, 450);
  }

  map.on("zoomend", () => {
    if (!enabled) return;
    for (const marker of markers.values()) {
      marker.setIcon(makeIcon(marker._hub, labeled()));
    }
  });

  return {
    id: "metar",
    name: "METAR",
    description: "Airport weather · color = flight category",
    color: "#22c55e",
    defaultOn: false,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    enable() {
      enabled = true;
      group.addTo(map);
      tick();
      timer = setInterval(tick, METAR_POLL_MS);
      map.on("moveend", onMove);
    },
    disable() {
      enabled = false;
      clearInterval(timer);
      clearTimeout(moveTimer);
      timer = null;
      map.off("moveend", onMove);
      map.removeLayer(group);
    },
  };
}
