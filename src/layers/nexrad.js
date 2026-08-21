import L from "leaflet";
import {
  DEFAULT_RADAR_SITES,
  LOOP_SPEED_OPTIONS,
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
import { mountPlaybackTrack } from "../playbackDock.js";

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
    // Keep weak returns — RadarScope-style detail lives in the dark greens/blues.
    if (r + g + b < (gentle ? 18 : 28)) {
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
    // Only scrub near-gray noise, not light precip echoes.
    if (s < 0.05 && v < 0.35) {
      data[i + 3] = 0;
      continue;
    }
    if (h >= 25 && h <= 100 && s < 0.35 && v < 0.55) {
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
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
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
        ctx.imageSmoothingEnabled = false;
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
  const savedSites = Array.isArray(saved.selected) ? saved.selected : DEFAULT_RADAR_SITES;
  let selectedId = savedSites[0] || DEFAULT_RADAR_SITES[0] || null;
  let showSites = saved.showSites !== false;
  let loopMinutes = NEXRAD_LOOP_OPTIONS.some((o) => o.minutes === saved.loopMinutes)
    ? saved.loopMinutes
    : 60;
  let speed = LOOP_SPEED_OPTIONS.some((o) => o.id === saved.speed) ? saved.speed : 1;
  let opacity = saved.opacity ?? 0.55;
  let product =
    NEXRAD_SITE_PRODUCTS.find((p) => p.id === saved.product) || NEXRAD_SITE_PRODUCTS[0];
  let playing = false;
  let frameIndex = 0;
  let frames = [];
  let siteScans = new Map();
  let playTimer = null;
  let liveTimer = null;
  let playGen = 0;
  let refreshBusy = false;
  let enabled = false;
  let error = null;
  let onChange = () => {};

  const sitesLayer = L.layerGroup();
  const radarGroup = L.layerGroup();
  const tileLayers = new Map();
  const siteMarkers = new Map();
  let sites = [];

  const {
    playBtn,
    clockEl,
    loopSelect,
    speedSelect,
    setVisible: setPlaybackVisible,
  } = mountPlaybackTrack({
    id: "radar",
    label: "Radar",
    playLabel: "radar",
    loopOptions: NEXRAD_LOOP_OPTIONS,
    loopMinutes,
    speed,
  });

  function persist() {
    saveRadarState({
      selected: selectedId ? [selectedId] : [],
      showSites,
      loopMinutes,
      speed,
      opacity,
      product: product.id,
    });
  }

  function frameDelayMs() {
    return Math.max(50, Math.round(NEXRAD_FRAME_MS / speed));
  }

  function selectedSet() {
    return selectedId ? new Set([selectedId]) : new Set();
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
    const on = site.id === selectedId;
    marker.setIcon(siteIcon(site, on, labelSites()));
    marker.setZIndexOffset(on ? 250 : 120);
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
      // 512px WMS tiles = 4× pixels vs default 256 for the same map area.
      tileSize: 512,
      maxZoom: 18,
      minZoom: 4,
      // Don't combine with tileSize 512 — detectRetina halves tileSize and shifts zoom.
      detectRetina: false,
      updateWhenZooming: false,
      updateWhenIdle: false,
      keepBuffer: 3,
      noWrap: true,
    });
    // Seed live bust so createTile and setFrame share one generation.
    layer._liveBust = Date.now();
    layer.wmsParams._ = layer._liveBust;
    return layer;
  }

  function ensureTiles() {
    const selected = selectedSet();
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
        icon: siteIcon(site, site.id === selectedId, labelSites()),
        zIndexOffset: site.id === selectedId ? 250 : 120,
      });
      marker.bindTooltip(
        `${site.id} · ${site.name}${site.state ? `, ${site.state}` : ""}`,
        { direction: "top", offset: [0, -8] },
      );
      marker.on("click", () => selectSite(site.id));
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
    const ids = selectedId ? [selectedId] : [];
    await Promise.all(
      ids.map(async (id) => {
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
    playGen += 1;
    clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = "Play";
    playBtn.setAttribute("aria-label", "Play radar loop");
    showLive();
  }

  function armPlayTimer() {
    clearInterval(playTimer);
    playTimer = setInterval(() => {
      if (!playing || !frames.length) return;
      frameIndex = (frameIndex + 1) % frames.length;
      applyFrame(frames[frameIndex]);
    }, frameDelayMs());
  }

  function restoreFrameIndex(prevTs) {
    if (!frames.length) {
      frameIndex = 0;
      return;
    }
    if (!prevTs) {
      frameIndex = Math.min(frameIndex, frames.length - 1);
      return;
    }
    const exact = frames.indexOf(prevTs);
    if (exact >= 0) {
      frameIndex = exact;
      return;
    }
    let best = 0;
    let bestDelta = Infinity;
    const target = new Date(prevTs).getTime();
    frames.forEach((ts, i) => {
      const delta = Math.abs(new Date(ts).getTime() - target);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = i;
      }
    });
    frameIndex = best;
  }

  async function startPlayback() {
    if (!selectedId) return;
    const gen = ++playGen;
    playing = false;
    clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = "…";
    try {
      await loadScans();
      if (gen !== playGen) return;
      if (!frames.length) {
        error = "No radar frames in that window";
        stopPlayback();
        onChange();
        return;
      }
      ensureTiles();
      await Promise.all([...tileLayers.values()].map(waitForTiles));
      if (gen !== playGen) return;
      await Promise.all(
        [...tileLayers.entries()].map(([id, layer]) =>
          layer.prefetch(siteScans.get(id) || frames),
        ),
      );
      if (gen !== playGen) return;
      error = null;
      playing = true;
      frameIndex = 0;
      playBtn.textContent = "Pause";
      playBtn.setAttribute("aria-label", "Pause radar loop");
      applyFrame(frames[0]);
      armPlayTimer();
    } catch (err) {
      if (gen !== playGen) return;
      error = err.message || "Radar loop unavailable";
      stopPlayback();
    }
    onChange();
  }

  /** Pull new scans into an already-playing loop without restarting from the beginning. */
  async function refreshLoopFrames() {
    if (!playing || !selectedId || refreshBusy) return;
    refreshBusy = true;
    const gen = playGen;
    const prevTs = frames[frameIndex] || null;
    const before = new Set(frames);
    try {
      await loadScans();
      if (gen !== playGen || !playing) return;
      if (!frames.length) return;
      const added = frames.filter((ts) => !before.has(ts));
      if (added.length) {
        ensureTiles();
        await Promise.all(
          [...tileLayers.entries()].map(([id, layer]) => {
            const scans = siteScans.get(id) || [];
            const fresh = added.filter((ts) => scans.includes(ts));
            return fresh.length ? layer.prefetch(fresh) : Promise.resolve();
          }),
        );
        if (gen !== playGen || !playing) return;
      }
      restoreFrameIndex(prevTs);
      error = null;
      onChange();
    } catch (err) {
      if (gen !== playGen) return;
      error = err.message || "Radar loop refresh failed";
      onChange();
    } finally {
      refreshBusy = false;
    }
  }

  function selectSite(id) {
    if (selectedId === id) return;
    const prev = selectedId;
    selectedId = id;
    persist();
    if (prev) {
      const old = siteById(prev);
      if (old) renderMarker(old);
    }
    const site = siteById(id);
    if (site) renderMarker(site);
    if (playing) startPlayback();
    else showLive();
    renderExtras();
    onChange();
  }

  function clearSite() {
    if (!selectedId) return;
    const prev = selectedId;
    selectedId = null;
    persist();
    const site = siteById(prev);
    if (site) renderMarker(site);
    if (playing) stopPlayback();
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
    extrasRoot.querySelector(".radar-selected").innerHTML = selectedId
      ? `<button type="button" class="radar-chip" data-site="${selectedId}">${selectedId} ×</button>`
      : `<span class="radar-hint">Click one site on the map</span>`;
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

  speedSelect.addEventListener("change", () => {
    speed = Number(speedSelect.value) || 1;
    persist();
    if (playing) armPlayTimer();
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
    description: "Super-res · one site at a time",
    color: "#22c55e",
    defaultOn: true,
    hasOpacity: true,
    getOpacity: () => opacity,
    getCount: () => (selectedId ? 1 : 0),
    getSelectedSites: () => (selectedId ? [selectedId] : []),
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
        if (btn) clearSite();
      });
      renderExtras();
    },
    async enable() {
      enabled = true;
      setPlaybackVisible(true);
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
        if (playing) refreshLoopFrames();
        else showLive({ bust: true });
      }, NEXRAD_REFRESH_MS);
      renderExtras();
      onChange();
    },
    disable() {
      enabled = false;
      stopPlayback();
      clearInterval(liveTimer);
      liveTimer = null;
      setPlaybackVisible(false);
      map.removeLayer(radarGroup);
      map.removeLayer(sitesLayer);
    },
  };
}
