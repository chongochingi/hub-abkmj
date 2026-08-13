import L from "leaflet";
import {
  DEFAULT_RADAR_SITES,
  NEXRAD_FRAME_MS,
  NEXRAD_LOOP_OPTIONS,
  NEXRAD_PRODUCT,
  NEXRAD_REFRESH_MS,
  NEXRAD_SCANS_URL,
  NEXRAD_SITES_URL,
  NEXRAD_TILE_BASE,
  STORAGE_KEY,
} from "../config.js";

function loadRadarState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").nexrad || {};
  } catch {
    return {};
  }
}

function saveRadarState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.nexrad = { ...(all.nexrad || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

function tileStamp(ts) {
  return String(ts).replace(/[-:TZ]/g, "").slice(0, 12);
}

function tileUrl(site, ts) {
  // IEM requires ridge::SITE-PRODUCT-0 for latest, or ...-YYYYMMDDHHMI for archive.
  const stamp = ts ? tileStamp(ts) : "0";
  return `${NEXRAD_TILE_BASE}/ridge::${site}-${NEXRAD_PRODUCT}-${stamp}/{z}/{x}/{y}.png`;
}

const EMPTY_TILE =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

function fmtFrameTime(ts) {
  if (!ts) return "Live";
  const d = new Date(ts.endsWith("Z") ? ts : `${ts}Z`);
  if (Number.isNaN(d.getTime())) return ts;
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZoneName: "short",
  });
}

function siteIcon(site, selected, showLabel) {
  const label = showLabel
    ? `<span class="radar-id">${site.id}</span>`
    : "";
  return L.divIcon({
    className: `radar-site${selected ? " is-selected" : ""}`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
    html: `<div class="radar-dot"></div>${label}`,
  });
}

export function createNexradLayer(map) {
  const saved = loadRadarState();
  const selected = new Set(saved.selected || DEFAULT_RADAR_SITES);
  let showSites = saved.showSites !== false;
  let loopMinutes = saved.loopMinutes || 60;
  let opacity = saved.opacity ?? 0.55;
  let playing = false;
  let frameIndex = 0;
  let frames = [];
  let siteScans = new Map();
  let playTimer = null;
  let liveTimer = null;
  let enabled = false;
  let error = null;
  let onChange = () => {};

  const sitesLayer = L.layerGroup();
  const radarGroup = L.layerGroup();
  const tileLayers = new Map();
  const siteMarkers = new Map();
  let sites = [];

  const playback = document.createElement("div");
  playback.className = "radar-playback";
  playback.hidden = true;
  playback.innerHTML = `
    <button type="button" class="play-btn" aria-label="Play radar loop">Play</button>
    <div class="radar-clock">Live</div>
    <label class="radar-loop-label">
      Loop
      <select class="radar-loop">
        ${NEXRAD_LOOP_OPTIONS.map(
          (opt) =>
            `<option value="${opt.minutes}" ${opt.minutes === loopMinutes ? "selected" : ""}>${opt.label}</option>`,
        ).join("")}
      </select>
    </label>
  `;
  document.body.appendChild(playback);

  const playBtn = playback.querySelector(".play-btn");
  const clockEl = playback.querySelector(".radar-clock");
  const loopSelect = playback.querySelector(".radar-loop");

  function persist() {
    saveRadarState({
      selected: [...selected],
      showSites,
      loopMinutes,
      opacity,
    });
  }

  function labelSites() {
    return map.getZoom() >= 7;
  }

  function renderMarker(site) {
    const marker = siteMarkers.get(site.id);
    if (!marker) return;
    marker.setIcon(siteIcon(site, selected.has(site.id), labelSites()));
  }

  function renderAllMarkers() {
    for (const site of sites) renderMarker(site);
  }

  function ensureTiles() {
    for (const id of selected) {
      if (tileLayers.has(id)) continue;
      const layer = L.tileLayer(tileUrl(id), {
        opacity,
        pane: "overlayPane",
        className: "nexrad-tiles",
        attribution: "NEXRAD © Iowa Environmental Mesonet",
        maxZoom: 16,
        errorTileUrl: EMPTY_TILE,
      });
      layer.addTo(radarGroup);
      tileLayers.set(id, layer);
    }
    for (const [id, layer] of tileLayers) {
      if (selected.has(id)) continue;
      radarGroup.removeLayer(layer);
      tileLayers.delete(id);
    }
  }

  function applyFrame(ts) {
    ensureTiles();
    for (const [id, layer] of tileLayers) {
      const scans = siteScans.get(id) || [];
      let stamp = ts;
      if (ts && scans.length) {
        stamp = null;
        for (const scan of scans) {
          if (scan <= ts) stamp = scan;
          else break;
        }
      }
      layer.setUrl(tileUrl(id, stamp));
      layer.setOpacity(opacity);
    }
    clockEl.textContent = fmtFrameTime(ts);
  }

  function showLive() {
    siteScans = new Map();
    frames = [];
    frameIndex = 0;
    applyFrame(null);
  }

  async function loadSites() {
    if (sites.length) return;
    const res = await fetch(NEXRAD_SITES_URL);
    if (!res.ok) throw new Error(`Radar sites HTTP ${res.status}`);
    const data = await res.json();
    sites = (data.features || [])
      .filter((f) => f.properties?.online !== false && f.geometry?.coordinates)
      .map((f) => ({
        id: f.properties.sid || f.id,
        name: f.properties.sname || f.properties.sid,
        state: f.properties.state || "",
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
      }));

    for (const site of sites) {
      const marker = L.marker([site.lat, site.lon], {
        icon: siteIcon(site, selected.has(site.id), labelSites()),
        zIndexOffset: selected.has(site.id) ? 250 : 120,
      });
      marker.bindTooltip(
        `${site.id} · ${site.name}${site.state ? `, ${site.state}` : ""}`,
        { direction: "top", offset: [0, -8] },
      );
      marker.on("click", () => toggleSite(site.id));
      siteMarkers.set(site.id, marker);
      marker.addTo(sitesLayer);
    }
  }

  async function loadScans() {
    const end = new Date();
    const start = new Date(end.getTime() - loopMinutes * 60 * 1000);
    const startIso = start.toISOString().replace(/\.\d{3}Z$/, "Z");
    const endIso = end.toISOString().replace(/\.\d{3}Z$/, "Z");
    const next = new Map();
    await Promise.all(
      [...selected].map(async (id) => {
        const url = `${NEXRAD_SCANS_URL}?operation=list&radar=${encodeURIComponent(id)}&product=${NEXRAD_PRODUCT}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
        const res = await fetch(url);
        if (!res.ok) return;
        const data = await res.json();
        next.set(
          id,
          (data.scans || []).map((s) => s.ts).filter(Boolean),
        );
      }),
    );
    siteScans = next;
    const all = new Set();
    for (const scans of siteScans.values()) {
      for (const ts of scans) all.add(ts);
    }
    frames = [...all].sort();
  }

  function stopPlayback() {
    playing = false;
    clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = "Play";
    playBtn.setAttribute("aria-label", "Play radar loop");
    showLive();
  }

  async function startPlayback() {
    if (!selected.size) return;
    playBtn.textContent = "…";
    try {
      await loadScans();
      if (!frames.length) {
        error = "No radar frames in that window";
        stopPlayback();
        onChange();
        return;
      }
      error = null;
      playing = true;
      frameIndex = 0;
      playBtn.textContent = "Pause";
      playBtn.setAttribute("aria-label", "Pause radar loop");
      applyFrame(frames[0]);
      clearInterval(playTimer);
      playTimer = setInterval(() => {
        frameIndex = (frameIndex + 1) % frames.length;
        applyFrame(frames[frameIndex]);
      }, NEXRAD_FRAME_MS);
    } catch (err) {
      error = err.message || "Radar loop unavailable";
      stopPlayback();
    }
    onChange();
  }

  function toggleSite(id) {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    persist();
    const site = sites.find((s) => s.id === id);
    if (site) {
      const marker = siteMarkers.get(id);
      if (marker) marker.setZIndexOffset(selected.has(id) ? 250 : 120);
      renderMarker(site);
    }
    if (playing) startPlayback();
    else showLive();
    renderExtras();
    onChange();
  }

  function setShowSites(value) {
    showSites = value;
    persist();
    if (showSites && enabled) {
      sitesLayer.addTo(map);
    } else {
      map.removeLayer(sitesLayer);
    }
  }

  let extrasRoot = null;

  function renderExtras() {
    if (!extrasRoot) return;
    const chips = [...selected]
      .map(
        (id) =>
          `<button type="button" class="radar-chip" data-site="${id}">${id} ×</button>`,
      )
      .join("");
    extrasRoot.querySelector(".radar-selected").innerHTML =
      chips || `<span class="radar-hint">Click a site on the map</span>`;
    extrasRoot.querySelector(".radar-show-sites").checked = showSites;
  }

  playBtn.addEventListener("click", () => {
    if (playing) stopPlayback();
    else startPlayback();
  });

  loopSelect.addEventListener("change", () => {
    loopMinutes = Number(loopSelect.value);
    persist();
    if (playing) startPlayback();
  });

  map.on("zoomend", () => {
    if (enabled && showSites) renderAllMarkers();
  });

  return {
    id: "nexrad",
    name: "NEXRAD radar",
    description: "Select sites on the map · N0B",
    color: "#22c55e",
    defaultOn: true,
    hasOpacity: true,
    getOpacity: () => opacity,
    getCount: () => selected.size,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    setOpacity(value) {
      opacity = value;
      persist();
      for (const layer of tileLayers.values()) layer.setOpacity(opacity);
    },
    mountExtras(container) {
      extrasRoot = container;
      container.classList.add("radar-extras");
      container.innerHTML = `
        <label class="check-row">
          <input type="checkbox" class="radar-show-sites" />
          Show radar sites
        </label>
        <div class="radar-selected"></div>
      `;
      container.querySelector(".radar-show-sites").addEventListener("change", (event) => {
        setShowSites(event.target.checked);
      });
      container.querySelector(".radar-selected").addEventListener("click", (event) => {
        const btn = event.target.closest("[data-site]");
        if (btn) toggleSite(btn.dataset.site);
      });
      renderExtras();
    },
    async enable() {
      enabled = true;
      playback.hidden = false;
      radarGroup.addTo(map);
      try {
        await loadSites();
        error = null;
      } catch (err) {
        error = err.message || "Radar sites unavailable";
      }
      if (showSites) sitesLayer.addTo(map);
      showLive();
      liveTimer = setInterval(() => {
        if (!playing) showLive();
      }, NEXRAD_REFRESH_MS);
      renderExtras();
      onChange();
    },
    disable() {
      enabled = false;
      stopPlayback();
      clearInterval(liveTimer);
      liveTimer = null;
      playback.hidden = true;
      map.removeLayer(radarGroup);
      map.removeLayer(sitesLayer);
    },
  };
}
