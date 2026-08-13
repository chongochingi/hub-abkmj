import L from "leaflet";
import {
  LAKE_NORMAL_POOL_FT,
  LAKE_USACE_CODES,
  USACE_POOL_URL,
  USGS_LAKES_POLL_MS,
  USGS_LAKES_URL,
} from "../config.js";

const PARAM_PRIORITY = {
  "62615": 0,
  "62614": 1,
  "00062": 2,
  "00065": 3,
};

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function shortName(name) {
  return String(name || "Lake")
    .replace(/\s+near\s+.+$/i, "")
    .replace(/\s+at\s+.+$/i, "")
    .replace(/,\s*OK$/i, "")
    .trim();
}

function fmtWhen(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
  });
}

function fmtDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return null;
  const abs = Math.abs(delta).toFixed(2);
  if (Math.abs(delta) < 0.05) return "At normal pool";
  if (delta > 0) return `+${abs} ft above normal`;
  return `-${abs} ft below normal`;
}

function deltaClass(delta) {
  if (delta == null || !Number.isFinite(delta)) return "";
  if (Math.abs(delta) < 0.05) return "is-even";
  return delta > 0 ? "is-high" : "is-low";
}

function parseSeries(data) {
  const series = data?.value?.timeSeries || [];
  const bySite = new Map();

  for (const item of series) {
    const site = item.sourceInfo || {};
    const siteCode = site.siteCode?.[0]?.value;
    const geo = site.geoLocation?.geogLocation || {};
    const lat = Number(geo.latitude);
    const lon = Number(geo.longitude);
    if (!siteCode || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    const param = item.variable?.variableCode?.[0]?.value || "";
    const priority = PARAM_PRIORITY[param] ?? 99;
    const values = item.values?.[0]?.value || [];
    const latest = values[values.length - 1];
    if (!latest?.value) continue;
    const level = Number(latest.value);
    if (!Number.isFinite(level)) continue;

    const next = {
      id: siteCode,
      name: site.siteName || siteCode,
      lat,
      lon,
      param,
      paramName: item.variable?.variableName || "Water level",
      unit: item.variable?.unit?.unitCode || "ft",
      level,
      when: latest.dateTime || "",
      priority,
    };

    const prev = bySite.get(siteCode);
    if (!prev || next.priority < prev.priority) bySite.set(siteCode, next);
  }

  return [...bySite.values()];
}

async function loadUsacePools() {
  try {
    const res = await fetch(USACE_POOL_URL, { cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    const byCode = {};
    for (const lv of data.levels || []) {
      const meters = lv["constant-value"];
      if (meters == null) continue;
      const code = String(lv["location-level-id"] || "").split(".")[0];
      if (!code) continue;
      byCode[code] = meters * 3.28084;
    }
    return byCode;
  } catch {
    return {};
  }
}

function attachPool(site, usacePools) {
  const fromUsace = usacePools[LAKE_USACE_CODES[site.id]];
  const normal = fromUsace ?? LAKE_NORMAL_POOL_FT[site.id] ?? null;
  const delta = normal != null ? site.level - normal : null;
  return { ...site, normal, delta };
}

function popupHtml(site) {
  const vs = fmtDelta(site.delta);
  return `
    <div class="popup-kicker">USGS lake</div>
    <div class="popup-title">${esc(site.name)}</div>
    <div class="popup-row">${esc(site.id)}${site.when ? ` · ${esc(fmtWhen(site.when))}` : ""}</div>
    <div class="popup-row">${esc(site.paramName)} · <strong>${site.level.toFixed(2)} ${esc(site.unit)}</strong></div>
    ${
      site.normal != null
        ? `<div class="popup-row">Normal pool ${site.normal.toFixed(1)} ft · <strong class="lake-delta ${deltaClass(site.delta)}">${esc(vs)}</strong></div>`
        : ""
    }
    <div class="popup-row"><a href="https://waterdata.usgs.gov/monitoring-location/${esc(site.id)}/" target="_blank" rel="noreferrer">USGS station</a></div>
  `;
}

function shortDelta(delta) {
  if (delta == null || !Number.isFinite(delta)) return "";
  if (Math.abs(delta) < 0.05) return "even";
  const sign = delta > 0 ? "+" : "";
  return `${sign}${delta.toFixed(1)} ft`;
}

function lakeIcon(site, showLabel) {
  const short = shortDelta(site.delta);
  const deltaLine = short
    ? `<br><span class="lake-delta ${deltaClass(site.delta)}">${esc(short)}</span>`
    : "";
  const label = showLabel
    ? `<span class="lake-label">${esc(shortName(site.name))}<br>${site.level.toFixed(1)} ${esc(site.unit)}${deltaLine}</span>`
    : `<span class="lake-label lake-label-sm">${site.level.toFixed(1)}${deltaLine}</span>`;
  return L.divIcon({
    className: `lake-marker ${deltaClass(site.delta)}`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div class="lake-dot"></div>${label}`,
  });
}

export function createLakesLayer(map) {
  const group = L.layerGroup();
  const markers = new Map();
  let sites = [];
  let usacePools = null;
  let timer = null;
  let count = 0;
  let error = null;
  let onChange = () => {};

  function showLabels() {
    return map.getZoom() >= 8;
  }

  function render() {
    const keep = new Set();
    const labeled = showLabels();
    for (const site of sites) {
      keep.add(site.id);
      const existing = markers.get(site.id);
      const icon = lakeIcon(site, labeled);
      if (existing) {
        existing.setLatLng([site.lat, site.lon]);
        existing.setIcon(icon);
        existing.setPopupContent(popupHtml(site));
      } else {
        const marker = L.marker([site.lat, site.lon], {
          icon,
          zIndexOffset: 280,
        });
        marker.bindPopup(popupHtml(site));
        marker.addTo(group);
        markers.set(site.id, marker);
      }
    }
    for (const [id, marker] of markers) {
      if (keep.has(id)) continue;
      group.removeLayer(marker);
      markers.delete(id);
    }
    count = sites.length;
  }

  async function tick() {
    try {
      if (!usacePools) usacePools = await loadUsacePools();
      const res = await fetch(USGS_LAKES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error(`USGS lakes HTTP ${res.status}`);
      sites = parseSeries(await res.json()).map((s) => attachPool(s, usacePools));
      render();
      error = null;
    } catch (err) {
      error = err.message || "USGS lake levels unavailable";
    }
    onChange();
  }

  map.on("zoomend", () => {
    if (group._map && sites.length) render();
  });

  return {
    id: "lakes",
    name: "Lake levels",
    description: "USGS stage vs normal pool",
    color: "#0ea5e9",
    defaultOn: false,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    enable() {
      group.addTo(map);
      tick();
      timer = setInterval(tick, USGS_LAKES_POLL_MS);
    },
    disable() {
      clearInterval(timer);
      timer = null;
      map.removeLayer(group);
    },
  };
}
