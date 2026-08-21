import { RAOB_NEAR_KM, RAOB_NETWORK_URL, SPC_SOUNDING_BASE } from "./config.js";
import { esc } from "./html.js";

let sitesPromise = null;
const openWindows = new Map();
const spcCache = new Map();

function kmBetween(aLat, aLon, bLat, bLon) {
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLon = toRad(bLon - aLon);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(s));
}

export function plotStationId(id) {
  const s = String(id || "")
    .toUpperCase()
    .replace(/^_/, "");
  if (s.length === 4 && s.startsWith("K")) return s.slice(1);
  return s;
}

/** SPC uses 3-letter WMO/ICAO-style ids (OUN, LMN, …). */
export function spcStationId(id) {
  return plotStationId(id).slice(0, 3);
}

export async function loadRaobSites() {
  if (!sitesPromise) {
    sitesPromise = fetch(RAOB_NETWORK_URL, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`RAOB network HTTP ${res.status}`);
        return res.json();
      })
      .then((data) =>
        (data.features || [])
          .map((feature) => {
            const p = feature.properties || {};
            const coords = feature.geometry?.coordinates;
            if (!coords) return null;
            const id = String(feature.id || p.sid || "").toUpperCase();
            if (!id || p.online === false) return null;
            return {
              id,
              name: p.sname || id,
              lat: coords[1],
              lon: coords[0],
              state: p.state || "",
            };
          })
          .filter(Boolean),
      )
      .catch((err) => {
        sitesPromise = null;
        throw err;
      });
  }
  return sitesPromise;
}

export function nearestRaob(lat, lon, sites, maxKm = RAOB_NEAR_KM) {
  let best = null;
  let bestKm = maxKm;
  for (const site of sites) {
    const km = kmBetween(lat, lon, site.lat, site.lon);
    if (km <= bestKm) {
      best = site;
      bestKm = km;
    }
  }
  return best ? { ...best, km: bestKm } : null;
}

export function matchRaobSite(stationId, sites) {
  if (!stationId) return null;
  const raw = String(stationId).toUpperCase();
  const ids = new Set([raw, `K${raw}`, plotStationId(raw), `_${plotStationId(raw)}`]);
  return sites.find((s) => ids.has(s.id) || ids.has(plotStationId(s.id))) || null;
}

function cycleKey(d) {
  return (
    String(d.getUTCFullYear()).slice(2) +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    String(d.getUTCDate()).padStart(2, "0") +
    String(d.getUTCHours()).padStart(2, "0")
  );
}

function parseCycleKey(key) {
  const yy = Number(key.slice(0, 2));
  const mm = Number(key.slice(2, 4));
  const dd = Number(key.slice(4, 6));
  const hh = Number(key.slice(6, 8));
  return new Date(Date.UTC(2000 + yy, mm - 1, dd, hh));
}

/** Candidate OBS hours: prefer 00/12, then special hours SPC sometimes posts. */
function candidateCycles(now = new Date()) {
  const keys = [];
  const seen = new Set();
  const push = (d) => {
    const key = cycleKey(d);
    if (seen.has(key)) return;
    seen.add(key);
    keys.push(key);
  };

  // Walk back ~4 days of synoptic releases first
  const syn = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours() >= 12 ? 12 : 0),
  );
  for (let i = 0; i < 8; i++) {
    push(new Date(syn.getTime() - i * 12 * 60 * 60 * 1000));
  }
  // Then recent hourly specials (e.g. 16Z)
  for (let i = 0; i < 36; i++) {
    push(new Date(now.getTime() - i * 60 * 60 * 1000));
  }
  return keys;
}

export function spcPlotUrl(stationId, cycle) {
  const stn = spcStationId(stationId);
  if (!stn || !cycle) return "";
  return `${SPC_SOUNDING_BASE}/${cycle}_OBS/${stn}.gif`;
}

export function spcPageUrl(cycle) {
  return `${SPC_SOUNDING_BASE}/${cycle}_OBS/`;
}

function gifExists(url) {
  return new Promise((resolve) => {
    const img = new Image();
    const done = (ok) => {
      img.onload = null;
      img.onerror = null;
      resolve(ok);
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

/**
 * Latest SPC NSHARP observed Skew-T for a station.
 * @returns {{ station, cycle, valid, plotUrl, pageUrl } | null}
 */
export async function fetchSpcSounding(stationId) {
  const station = spcStationId(stationId);
  if (!station) return null;
  if (spcCache.has(station)) return spcCache.get(station);

  for (const cycle of candidateCycles()) {
    const plotUrl = spcPlotUrl(station, cycle);
    if (await gifExists(plotUrl)) {
      const hit = {
        station,
        cycle,
        valid: parseCycleKey(cycle).toISOString(),
        plotUrl,
        pageUrl: spcPageUrl(cycle),
      };
      spcCache.set(station, hit);
      return hit;
    }
  }
  spcCache.set(station, null);
  return null;
}

function whenLabel(valid) {
  const when = new Date(valid);
  if (Number.isNaN(when.getTime())) return String(valid || "");
  return when.toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZoneName: "short",
  });
}

export function openSkewTWindow(stationId, { title } = {}) {
  const id = spcStationId(stationId);
  const name = `skew-${id}`;
  const existing = openWindows.get(name);
  if (existing && !existing.closed) {
    existing.focus();
    return existing;
  }

  const params = new URLSearchParams({
    station: id,
    title: title || `${id} SPC Skew-T`,
  });
  const win = window.open(
    `/sounding.html?${params}`,
    name,
    "popup=yes,width=980,height=820,menubar=no,toolbar=no,location=no,status=no,resizable=yes,scrollbars=yes",
  );
  if (win) openWindows.set(name, win);
  return win;
}

export function soundingHtml(sounding, { nearbyKm } = {}) {
  if (!sounding?.plotUrl) return "";
  const station = sounding.station;
  const km =
    nearbyKm != null && nearbyKm > 1 ? ` · ${Math.round(nearbyKm)} km away` : "";
  const when = whenLabel(sounding.valid);

  return `
    <div class="popup-sounding">
      <div class="popup-kicker">SPC Skew-T · ${esc(station)}${esc(km)}</div>
      <div class="popup-row">${esc(when)}</div>
      <button type="button" class="sounding-open-btn" data-station="${esc(station)}">Open full Skew-T</button>
      <a class="popup-row" href="${esc(sounding.pageUrl)}" target="_blank" rel="noreferrer">SPC sounding page</a>
      <img class="popup-skewt" alt="SPC Skew-T for ${esc(station)}" src="${esc(sounding.plotUrl)}" loading="lazy" />
    </div>
  `;
}

export async function soundingBlock({ lat, lon, stationId }) {
  const sites = await loadRaobSites();
  const matched = matchRaobSite(stationId, sites);
  const near = matched || (lat != null && lon != null ? nearestRaob(lat, lon, sites) : null);
  if (!near) return "";
  const sounding = await fetchSpcSounding(near.id);
  if (!sounding) return "";
  return soundingHtml(sounding, { nearbyKm: matched ? 0 : near.km });
}

export function attachSoundingPopup(layer, getSite) {
  layer.on("popupopen", async () => {
    const root = layer.getPopup()?.getElement()?.querySelector("[data-sounding]");
    if (!root || root.dataset.loaded) return;
    root.dataset.loaded = "1";
    root.innerHTML = `<div class="popup-row">Loading SPC Skew-T…</div>`;
    try {
      const site = getSite() || {};
      const html = await soundingBlock(site);
      if (html) {
        root.innerHTML = html;
        const btn = root.querySelector(".sounding-open-btn");
        const img = root.querySelector(".popup-skewt");
        const open = () => openSkewTWindow(btn?.dataset.station || site.stationId);
        btn?.addEventListener("click", open);
        img?.addEventListener("click", open);
      } else {
        root.remove();
      }
    } catch {
      root.remove();
    }
  });
}
