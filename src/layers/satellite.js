import L from "leaflet";
import {
  GOES_CHANNELS,
  GOES_FRAME_MS,
  GOES_LOOP_OPTIONS,
  GOES_REFRESH_MS,
  GOES_TILE_URL,
  GOES_TIMES_URL,
  STORAGE_KEY,
} from "../config.js";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").satellite || {};
  } catch {
    return {};
  }
}

function saveState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.satellite = { ...(all.satellite || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function parseGoesTime(ts) {
  const [day, clock] = String(ts).split(".");
  if (!day || !clock) return null;
  const d = new Date(
    Date.UTC(
      Number(day.slice(0, 4)),
      Number(day.slice(4, 6)) - 1,
      Number(day.slice(6, 8)),
      Number(clock.slice(0, 2)),
      Number(clock.slice(2, 4)),
      Number(clock.slice(4, 6) || "0"),
    ),
  );
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtFrameTime(ts) {
  const d = parseGoesTime(ts);
  if (!d) return "Live";
  return d.toLocaleString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    month: "short",
    day: "numeric",
    timeZoneName: "short",
  });
}

function punchSpace(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (data[i] + data[i + 1] + data[i + 2] < 18) data[i + 3] = 0;
  }
}

const GoesTiles = L.TileLayer.extend({
  initialize(url, options) {
    this._frameCache = new Map();
    this._inflight = new Map();
    this._frameTime = options.frameTime || null;
    L.TileLayer.prototype.initialize.call(this, url, options);
  },

  createTile(coords, done) {
    const tile = document.createElement("canvas");
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    tile.className = "leaflet-tile";
    this._paintCanvas(tile, coords, this._frameTime, () => done(null, tile));
    return tile;
  },

  setFrame(time) {
    this._frameTime = time || null;
    this._repaintExisting();
  },

  prefetch(times) {
    const coords = [];
    for (const key in this._tiles) {
      const rec = this._tiles[key];
      if (rec?.coords) coords.push(rec.coords);
    }
    if (!coords.length || !times.length) return Promise.resolve();
    return Promise.all(times.flatMap((time) => coords.map((c) => this._fetchFiltered(c, time))));
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
    return `${this.options.product}|${time || "live"}|${coords.x}|${coords.y}|${coords.z}`;
  },

  _urlFor(coords, time) {
    return L.Util.template(this._url, {
      product: this.options.product,
      time: String(time).replace(".", "_"),
      z: coords.z,
      x: coords.x,
      y: coords.y,
    });
  },

  _paintCanvas(canvas, coords, time, done) {
    const gen = (canvas._satGen = (canvas._satGen || 0) + 1);
    const blit = (src) => {
      if (canvas._satGen !== gen) return;
      const ctx = canvas.getContext("2d");
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(src, 0, 0);
      done?.();
    };
    const cached = this._frameCache.get(this._cacheKey(coords, time));
    if (cached) {
      blit(cached);
      return;
    }
    this._fetchFiltered(coords, time).then((src) => {
      if (!src) {
        if (canvas._satGen === gen) done?.();
        return;
      }
      blit(src);
    });
  },

  _fetchFiltered(coords, time) {
    if (!time) return Promise.resolve(null);
    const key = this._cacheKey(coords, time);
    const hit = this._frameCache.get(key);
    if (hit) return Promise.resolve(hit);
    const pending = this._inflight.get(key);
    if (pending) return pending;

    const req = new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const size = this.getTileSize();
        const off = document.createElement("canvas");
        off.width = size.x;
        off.height = size.y;
        const ctx = off.getContext("2d", { willReadFrequently: true });
        ctx.drawImage(img, 0, 0, off.width, off.height);
        try {
          const imageData = ctx.getImageData(0, 0, off.width, off.height);
          punchSpace(imageData.data);
          ctx.putImageData(imageData, 0, 0);
        } catch {
          /* CORS taint — keep the unfiltered tile */
        }
        this._frameCache.set(key, off);
        this._trimCache();
        resolve(off);
      };
      img.onerror = () => resolve(null);
      img.src = this._urlFor(coords, time);
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

export function createSatelliteLayer(map) {
  const saved = loadState();
  let channel =
    GOES_CHANNELS.find((c) => c.id === saved.channel) ||
    GOES_CHANNELS.find((c) => c.id === "ir") ||
    GOES_CHANNELS[0];
  let opacity = saved.opacity ?? 0.7;
  let loopMinutes = saved.loopMinutes || 60;
  let extrasRoot = null;
  let layer = null;
  let allTimes = [];
  let frames = [];
  let frameIndex = 0;
  let playing = false;
  let playTimer = null;
  let liveTimer = null;
  let enabled = false;
  let error = null;
  let onChange = () => {};

  const playback = document.createElement("div");
  playback.className = "radar-playback sat-playback";
  playback.hidden = true;
  playback.innerHTML = `
    <span class="playback-kind">Sat</span>
    <button type="button" class="play-btn" aria-label="Play satellite loop">Play</button>
    <div class="radar-clock">Live</div>
    <label class="radar-loop-label">
      Loop
      <select class="radar-loop">
        ${GOES_LOOP_OPTIONS.map(
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
    saveState({ channel: channel.id, opacity, loopMinutes });
  }

  function waitForTiles() {
    return new Promise((resolve) => {
      if (!layer) {
        resolve();
        return;
      }
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

  function ensureLayer() {
    if (layer) {
      layer.options.product = channel.product;
      layer.setOpacity(opacity);
      return;
    }
    layer = new GoesTiles(GOES_TILE_URL, {
      product: channel.product,
      opacity,
      pane: "overlayPane",
      className: "goes-tiles",
      attribution: "GOES-East ABI © NOAA / CIMSS RealEarth",
      maxZoom: 12,
      maxNativeZoom: 8,
      crossOrigin: true,
    });
    layer.addTo(map);
    layer.bringToBack();
  }

  function applyFrame(ts) {
    if (!layer || !ts) return;
    layer.setFrame(ts);
    clockEl.textContent = fmtFrameTime(ts);
  }

  function showLive() {
    const latest = allTimes[allTimes.length - 1];
    if (!latest) {
      clockEl.textContent = "Live";
      return;
    }
    ensureLayer();
    applyFrame(latest);
  }

  async function loadTimes() {
    const url = `${GOES_TIMES_URL}?products=${encodeURIComponent(channel.product)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Satellite times HTTP ${res.status}`);
    const data = await res.json();
    const list = data[channel.product] || [];
    allTimes = list.filter((ts) => parseGoesTime(ts));
  }

  function framesInWindow() {
    const end = Date.now();
    const start = end - loopMinutes * 60 * 1000;
    return allTimes.filter((ts) => {
      const t = parseGoesTime(ts)?.getTime();
      return Number.isFinite(t) && t >= start && t <= end;
    });
  }

  function stopPlayback() {
    playing = false;
    clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = "Play";
    playBtn.setAttribute("aria-label", "Play satellite loop");
    showLive();
  }

  async function startPlayback() {
    playing = false;
    clearInterval(playTimer);
    playTimer = null;
    playBtn.textContent = "…";
    try {
      await loadTimes();
      frames = framesInWindow();
      if (!frames.length) {
        error = "No satellite frames in that window";
        stopPlayback();
        onChange();
        return;
      }
      ensureLayer();
      await waitForTiles();
      await layer.prefetch(frames);
      error = null;
      playing = true;
      frameIndex = 0;
      playBtn.textContent = "Pause";
      playBtn.setAttribute("aria-label", "Pause satellite loop");
      applyFrame(frames[0]);
      playTimer = setInterval(() => {
        if (!playing || !frames.length) return;
        frameIndex = (frameIndex + 1) % frames.length;
        applyFrame(frames[frameIndex]);
      }, GOES_FRAME_MS);
    } catch (err) {
      error = err.message || "Satellite loop unavailable";
      stopPlayback();
    }
    onChange();
  }

  async function refreshLive() {
    if (!enabled || playing) return;
    try {
      await loadTimes();
      error = null;
      showLive();
    } catch (err) {
      error = err.message || "Satellite unavailable";
    }
    onChange();
  }

  function setChannel(id) {
    const next = GOES_CHANNELS.find((c) => c.id === id);
    if (!next || next.id === channel.id) return;
    channel = next;
    persist();
    if (layer) {
      layer.clearFrameCache();
      layer.options.product = channel.product;
    }
    renderExtras();
    if (enabled) {
      if (playing) startPlayback();
      else refreshLive();
    }
    onChange();
  }

  function renderExtras() {
    if (!extrasRoot) return;
    extrasRoot.querySelectorAll("[data-goes]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.goes === channel.id);
    });
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

  return {
    id: "satellite",
    name: "GOES East",
    description: "Visible, IR, water vapor · loop",
    color: "#c4b5fd",
    defaultOn: false,
    hasOpacity: true,
    getOpacity: () => opacity,
    getCount: () => null,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    setOpacity(value) {
      opacity = value;
      persist();
      if (layer) layer.setOpacity(opacity);
    },
    mountExtras(container) {
      extrasRoot = container;
      container.innerHTML = `
        <div class="meso-vars">
          ${GOES_CHANNELS.map(
            (c) =>
              `<button type="button" class="meso-chip" data-goes="${c.id}">${c.label}</button>`,
          ).join("")}
        </div>
      `;
      container.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-goes]");
        if (btn) setChannel(btn.dataset.goes);
      });
      renderExtras();
    },
    async enable() {
      enabled = true;
      playback.hidden = false;
      try {
        ensureLayer();
        await loadTimes();
        error = null;
        showLive();
      } catch (err) {
        error = err.message || "Satellite unavailable";
      }
      liveTimer = setInterval(refreshLive, GOES_REFRESH_MS);
      onChange();
    },
    disable() {
      enabled = false;
      playing = false;
      clearInterval(playTimer);
      playTimer = null;
      clearInterval(liveTimer);
      liveTimer = null;
      playBtn.textContent = "Play";
      playBtn.setAttribute("aria-label", "Play satellite loop");
      playback.hidden = true;
      if (layer) {
        map.removeLayer(layer);
        layer.clearFrameCache?.();
        layer = null;
      }
    },
  };
}
