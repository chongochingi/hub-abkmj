import L from "leaflet";
import {
  DEFAULT_RADAR_SITES,
  NCEP_WMS_BASE,
  NEXRAD_FRAME_MS,
  NEXRAD_LOOP_OPTIONS,
  NEXRAD_PRODUCT,
  NEXRAD_REFRESH_MS,
  NEXRAD_SCANS_URL,
  NEXRAD_SITE_PRODUCTS,
  NEXRAD_SITES_URL,
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

function ncepId(sid, state = "") {
  const code = String(sid || "").toUpperCase();
  if (code.length === 4) return code.toLowerCase();
  const st = String(state || "").toUpperCase();
  let prefix = "K";
  if (st === "AK" || st === "HI" || st === "GU" || code === "GUA") prefix = "P";
  else if (st === "PR" || code === "JUA") prefix = "T";
  return `${prefix}${code}`.toLowerCase();
}

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

function parseWmsTimes(xml) {
  const doc = new DOMParser().parseFromString(xml, "text/xml");
  const dim =
    doc.querySelector("Dimension[name='time']") ||
    doc.querySelector("Dimension[name='TIME']") ||
    doc.querySelector("Extent[name='time']");
  if (!dim) return [];
  return dim.textContent
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function nearestScan(scans, ts) {
  if (!ts || !scans.length) return ts || null;
  let stamp = null;
  for (const scan of scans) {
    if (scan <= ts) stamp = scan;
    else break;
  }
  return stamp;
}

/** Punch out near-black / noise so the basemap shows through. */
function filterRadarPixels(data, mode = "reflectivity", gentle = false) {
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    if (r + g + b < (gentle ? 24 : 40)) {
      data[i + 3] = 0;
      continue;
    }
    if (gentle || mode !== "reflectivity") continue;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const d = max - min;
    const s = max === 0 ? 0 : d / max;
    const v = max / 255;
    let h = 0;
    if (d !== 0) {
      if (max === r) h = ((g - b) / d) % 6;
      else if (max === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60;
      if (h < 0) h += 360;
    }
    if (s < 0.08) {
      data[i + 3] = 0;
      continue;
    }
    if (h >= 25 && h <= 100 && s < 0.45 && v < 0.8) {
      data[i + 3] = 0;
    }
  }
}

/** Shared across all radar site layers so fast zooms can't stampede NCEP. */
const radarFetchQueue = [];
let radarFetchActive = 0;
const RADAR_FETCH_MAX = 6;

function enqueueRadarFetch(task) {
  return new Promise((resolve) => {
    radarFetchQueue.push({ task, resolve, cancelled: false });
    pumpRadarFetchQueue();
  });
}

function pumpRadarFetchQueue() {
  while (radarFetchActive < RADAR_FETCH_MAX && radarFetchQueue.length) {
    const job = radarFetchQueue.shift();
    if (job.cancelled) {
      job.resolve(null);
      continue;
    }
    radarFetchActive += 1;
    Promise.resolve()
      .then(job.task)
      .then((value) => job.resolve(value))
      .catch(() => job.resolve(null))
      .finally(() => {
        radarFetchActive -= 1;
        pumpRadarFetchQueue();
      });
  }
}

function flushRadarFetchQueue() {
  while (radarFetchQueue.length) {
    const job = radarFetchQueue.shift();
    job.cancelled = true;
    job.resolve(null);
  }
}

const SuperResWms = L.TileLayer.WMS.extend({
  initialize(url, options) {
    this._frameCache = new Map();
    this._inflight = new Map();
    this._frameTime = null;
    this._liveBust = Date.now();
    L.TileLayer.WMS.prototype.initialize.call(this, url, options);
  },

  createTile(coords, done) {
    const tile = document.createElement("canvas");
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    tile.className = "leaflet-tile";
    // Leaflet TileLayer._abortLoading deletes tiles with !complete on zoom.
    // Canvas has no native complete flag, so without this every zoom wipes radar.
    tile.complete = false;
    tile._radarLeafletDone = done;
    this._paintCanvas(tile, coords, this._frameTime);
    return tile;
  },

  // Canvas tiles are not <img> — don't poke src= or abort logic will break fades.
  _removeTile(key) {
    const tile = this._tiles[key];
    if (!tile) return;
    if (tile.el) tile.el._radarGen = (tile.el._radarGen || 0) + 1;
    return L.GridLayer.prototype._removeTile.call(this, key);
  },

  _abortLoading() {
    for (const i in this._tiles) {
      const rec = this._tiles[i];
      if (!rec || rec.coords.z === this._tileZoom) continue;
      const tile = rec.el;
      // Keep already-painted canvases so Leaflet can scale them during zoom.
      if (tile?.complete) continue;
      if (tile) tile._radarGen = (tile._radarGen || 0) + 1;
      L.DomUtil.remove(tile);
      delete this._tiles[i];
      this.fire("tileabort", { tile, coords: rec.coords });
    }
  },

  _tileReady(coords, err, tile) {
    if (!this._map) return;
    // Skip TileLayer's emptyImageUrl short-circuit (img-only).
    return L.GridLayer.prototype._tileReady.call(this, coords, err, tile);
  },

  setFrame(time, { bust = false } = {}) {
    this._frameTime = time || null;
    if (time) {
      this.wmsParams.TIME = time;
      delete this.wmsParams._;
    } else {
      delete this.wmsParams.TIME;
      delete this.wmsParams.time;
      if (bust || !this.wmsParams._) {
        this._liveBust = Date.now();
        this.wmsParams._ = this._liveBust;
      }
    }
    this._repaintExisting();
  },

  prefetch(times) {
    const coords = [];
    for (const key in this._tiles) {
      const rec = this._tiles[key];
      if (rec?.coords) coords.push(rec.coords);
    }
    if (!coords.length || !times.length) return Promise.resolve();
    return Promise.all(
      times.flatMap((time) => coords.map((c) => this._fetchFiltered(c, time))),
    );
  },

  clearFrameCache() {
    this._frameCache.clear();
    this._inflight.clear();
  },

  _repaintExisting() {
    for (const key in this._tiles) {
      const rec = this._tiles[key];
      if (rec?.el && rec.coords) this._paintCanvas(rec.el, rec.coords, this._frameTime);
    }
  },

  _cacheKey(coords, time) {
    const size = this.getTileSize().x;
    const stamp = time || `live:${this.wmsParams._ || this._liveBust || 0}`;
    return `${stamp}|${coords.x}|${coords.y}|${coords.z}|${size}`;
  },

  _urlFor(coords, time) {
    const savedTime = this.wmsParams.TIME;
    const savedTimeL = this.wmsParams.time;
    const savedBust = this.wmsParams._;
    if (time) {
      this.wmsParams.TIME = time;
      delete this.wmsParams._;
    } else {
      delete this.wmsParams.TIME;
      delete this.wmsParams.time;
      this.wmsParams._ = savedBust || this._liveBust || Date.now();
    }
    const url = this.getTileUrl(coords);
    if (savedTime != null) this.wmsParams.TIME = savedTime;
    else delete this.wmsParams.TIME;
    if (savedTimeL != null) this.wmsParams.time = savedTimeL;
    else delete this.wmsParams.time;
    if (savedBust != null) this.wmsParams._ = savedBust;
    else delete this.wmsParams._;
    return url;
  },

  _notifyLeaflet(canvas) {
    canvas.complete = true;
    const done = canvas._radarLeafletDone;
    if (!done) return;
    canvas._radarLeafletDone = null;
    done(null, canvas);
  },

  _wantedCoords(coords) {
    return this._map && this._tileZoom != null && coords.z === this._tileZoom;
  },

  _paintCanvas(canvas, coords, time) {
    const gen = (canvas._radarGen = (canvas._radarGen || 0) + 1);
    if (!this._wantedCoords(coords)) {
      this._notifyLeaflet(canvas);
      return;
    }
    const blit = (src) => {
      if (canvas._radarGen !== gen || !this._wantedCoords(coords)) return false;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0);
      this._notifyLeaflet(canvas);
      return true;
    };
    const cached = this._frameCache.get(this._cacheKey(coords, time));
    if (cached) {
      blit(cached);
      return;
    }
    this._fetchFiltered(coords, time).then((src) => {
      if (canvas._radarGen !== gen) return;
      if (!src || !this._wantedCoords(coords)) {
        this._notifyLeaflet(canvas);
        return;
      }
      blit(src);
    });
  },

  _loadImage(url, attempt = 0) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const finish = (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      };
      const retry = () => {
        // One retry only — fast zooming used to stack many 12s timeouts.
        if (attempt >= 1) {
          finish(null);
          return;
        }
        const sep = url.includes("?") ? "&" : "?";
        finish(this._loadImage(`${url}${sep}r=${attempt + 1}`, attempt + 1));
      };
      const timer = setTimeout(() => {
        img.onload = img.onerror = null;
        img.src = "";
        retry();
      }, 8000);
      img.crossOrigin = "anonymous";
      img.onload = () => finish(img);
      img.onerror = () => setTimeout(retry, 200);
      img.src = url;
    }).then((value) => (value && typeof value.then === "function" ? value : value));
  },

  _fetchFiltered(coords, time) {
    if (!this._wantedCoords(coords)) return Promise.resolve(null);
    const key = this._cacheKey(coords, time);
    const hit = this._frameCache.get(key);
    if (hit) return Promise.resolve(hit);
    const pending = this._inflight.get(key);
    if (pending) return pending;

    const req = enqueueRadarFetch(() => {
      if (!this._wantedCoords(coords)) return null;
      return this._loadImage(this._urlFor(coords, time)).then((img) => {
        if (!img || !this._wantedCoords(coords)) return null;
        const size = this.getTileSize();
        const off = document.createElement("canvas");
        off.width = size.x;
        off.height = size.y;
        const ctx = off.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, off.width, off.height);
        try {
          const imageData = ctx.getImageData(0, 0, off.width, off.height);
          // Skip heavy HSV scrub while the map is mid-zoom.
          const animating = Boolean(this._map?._animatingZoom);
          const gentle = animating || (coords.z || 0) <= 8;
          filterRadarPixels(
            imageData.data,
            this.options.radarFilter || "reflectivity",
            gentle,
          );
          ctx.putImageData(imageData, 0, 0);
        } catch {
          /* CORS taint — keep the unfiltered tile */
        }
        this._frameCache.set(key, off);
        this._trimCache();
        return off;
      });
    }).finally(() => {
      this._inflight.delete(key);
    });

    this._inflight.set(key, req);
    return req;
  },

  _trimCache() {
    if (this._frameCache.size <= 480) return;
    const keys = this._frameCache.keys();
    while (this._frameCache.size > 360) {
      this._frameCache.delete(keys.next().value);
    }
  },
});

export function createNexradLayer(map) {
  const saved = loadRadarState();
  const selected = new Set(saved.selected || DEFAULT_RADAR_SITES);
  let showSites = saved.showSites !== false;
  let loopMinutes = saved.loopMinutes || 60;
  let opacity = saved.opacity ?? 0.55;
  let product =
    NEXRAD_SITE_PRODUCTS.find((p) => p.id === saved.product) || NEXRAD_SITE_PRODUCTS[0];
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
    <span class="playback-kind">Radar</span>
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
      product: product.id,
    });
  }

  function labelSites() {
    return map.getZoom() >= 7;
  }

  function siteById(id) {
    return sites.find((s) => s.id === id);
  }

  function renderMarker(site) {
    const marker = siteMarkers.get(site.id);
    if (!marker) return;
    marker.setIcon(siteIcon(site, selected.has(site.id), labelSites()));
  }

  function renderAllMarkers() {
    for (const site of sites) renderMarker(site);
  }

  function makeLayer(id) {
    const site = siteById(id);
    const ncep = ncepId(id, site?.state);
    const layer = new SuperResWms(`${NCEP_WMS_BASE}/${ncep}/ows?`, {
      layers: `${ncep}_${product.layer}`,
      styles: product.style,
      radarFilter: product.filter,
      format: "image/png",
      transparent: true,
      version: "1.1.1",
      uppercase: true,
      attribution: "NEXRAD Super-Res © NWS/NCEP",
      opacity,
      pane: "overlayPane",
      className: "nexrad-tiles",
      maxZoom: 18,
      minZoom: 4,
      detectRetina: false,
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 4,
    });
    // Seed live bust so createTile and setFrame share one generation.
    layer._liveBust = Date.now();
    layer.wmsParams._ = layer._liveBust;
    return layer;
  }

  function ensureTiles() {
    for (const id of selected) {
      if (tileLayers.has(id)) continue;
      const layer = makeLayer(id);
      tileLayers.set(id, layer);
      layer.addTo(radarGroup);
    }
    for (const [id, layer] of tileLayers) {
      if (selected.has(id)) continue;
      radarGroup.removeLayer(layer);
      layer.clearFrameCache?.();
      tileLayers.delete(id);
    }
  }

  function applyFrame(ts, { bust = false } = {}) {
    ensureTiles();
    clockEl.textContent = fmtFrameTime(ts);
    for (const [id, layer] of tileLayers) {
      const stamp = nearestScan(siteScans.get(id) || [], ts) || null;
      layer.setFrame(stamp, { bust: Boolean(bust && !stamp) });
    }
  }

  function showLive({ bust = true } = {}) {
    siteScans = new Map();
    frames = [];
    frameIndex = 0;
    applyFrame(null, { bust });
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

  async function loadIemScans(id, startIso, endIso) {
    const url = `${NEXRAD_SCANS_URL}?operation=list&radar=${encodeURIComponent(id)}&product=${encodeURIComponent(product.iem || NEXRAD_PRODUCT)}&start=${encodeURIComponent(startIso)}&end=${encodeURIComponent(endIso)}`;
    const res = await fetch(url);
    if (!res.ok) return [];
    const data = await res.json();
    return (data.scans || []).map((s) => s.ts).filter(Boolean);
  }

  async function loadNcepTimes(id) {
    const site = siteById(id);
    const ncep = ncepId(id, site?.state);
    const url = `${NCEP_WMS_BASE}/${ncep}/ows?service=WMS&version=1.3.0&request=GetCapabilities`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`caps ${res.status}`);
    return parseWmsTimes(await res.text());
  }

  async function loadScans() {
    const end = Date.now();
    const start = end - loopMinutes * 60 * 1000;
    const startIso = new Date(start).toISOString().replace(/\.\d{3}Z$/, "Z");
    const endIso = new Date(end).toISOString().replace(/\.\d{3}Z$/, "Z");
    const next = new Map();
    await Promise.all(
      [...selected].map(async (id) => {
        let times = [];
        try {
          times = await loadNcepTimes(id);
        } catch {
          times = [];
        }
        times = times.filter((ts) => {
          const t = new Date(ts).getTime();
          return Number.isFinite(t) && t >= start && t <= end;
        });
        if (!times.length) {
          times = await loadIemScans(id, startIso, endIso);
        }
        next.set(id, times);
      }),
    );
    siteScans = next;
    const all = new Set();
    for (const scans of siteScans.values()) {
      for (const ts of scans) all.add(ts);
    }
    frames = [...all].sort();
  }

  function waitForTiles(layer) {
    return new Promise((resolve) => {
      if (layer._tiles && Object.keys(layer._tiles).length) {
        resolve();
        return;
      }
      const done = () => {
        layer.off("load", done);
        resolve();
      };
      layer.once("load", done);
      setTimeout(done, 1500);
    });
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
    playing = false;
    clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = "…";
    try {
      await loadScans();
      if (!frames.length) {
        error = "No radar frames in that window";
        stopPlayback();
        onChange();
        return;
      }
      ensureTiles();
      await Promise.all([...tileLayers.values()].map(waitForTiles));
      await Promise.all(
        [...tileLayers.entries()].map(([id, layer]) =>
          layer.prefetch(siteScans.get(id) || frames),
        ),
      );
      error = null;
      playing = true;
      frameIndex = 0;
      playBtn.textContent = "Pause";
      playBtn.setAttribute("aria-label", "Pause radar loop");
      applyFrame(frames[0]);
      playTimer = setInterval(() => {
        if (!playing || !frames.length) return;
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
    const site = siteById(id);
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

  function rebuildTiles() {
    for (const [id, layer] of [...tileLayers]) {
      radarGroup.removeLayer(layer);
      layer.clearFrameCache?.();
      tileLayers.delete(id);
    }
    if (enabled) {
      ensureTiles();
      if (playing) startPlayback();
      else showLive();
    }
  }

  function setProduct(id) {
    const next = NEXRAD_SITE_PRODUCTS.find((p) => p.id === id);
    if (!next || next.id === product.id) return;
    product = next;
    persist();
    rebuildTiles();
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
    extrasRoot.querySelectorAll("[data-product]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.product === product.id);
    });
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

  let zoomTimer = null;

  map.on("zoomstart", () => {
    if (!enabled) return;
    flushRadarFetchQueue();
  });

  map.on("zoomend", () => {
    if (enabled && showSites) renderAllMarkers();
    if (!enabled) return;
    clearTimeout(zoomTimer);
    zoomTimer = setTimeout(() => {
      if (!enabled) return;
      if (playing && frames.length) {
        applyFrame(frames[frameIndex], { bust: false });
        return;
      }
      for (const layer of tileLayers.values()) {
        const tiles = layer._tiles || {};
        if (!Object.keys(tiles).length) {
          layer.redraw();
          continue;
        }
        // Only re-kick tiles that never finished painting after a fast zoom.
        for (const key of Object.keys(tiles)) {
          const rec = tiles[key];
          if (rec?.el && rec.coords && !rec.el.complete) {
            layer._paintCanvas(rec.el, rec.coords, layer._frameTime);
          }
        }
      }
    }, 200);
  });

  return {
    id: "nexrad",
    name: "NEXRAD",
    description: "Super-res · click sites on the map",
    color: "#22c55e",
    defaultOn: true,
    hasOpacity: true,
    getOpacity: () => opacity,
    getCount: () => selected.size,
    getSelectedSites: () => [...selected],
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
        <div class="meso-vars">
          ${NEXRAD_SITE_PRODUCTS.map(
            (p) =>
              `<button type="button" class="meso-chip" data-product="${p.id}">${p.label}</button>`,
          ).join("")}
        </div>
        <label class="check-row">
          <input type="checkbox" class="radar-show-sites" />
          Show radar sites
        </label>
        <div class="radar-selected"></div>
      `;
      container.addEventListener("click", (event) => {
        const prod = event.target.closest("[data-product]");
        if (prod) setProduct(prod.dataset.product);
      });
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
      showLive({ bust: true });
      liveTimer = setInterval(() => {
        if (!playing) showLive({ bust: true });
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
