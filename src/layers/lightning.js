import L from "leaflet";
import { GLM_PRODUCT, GLM_REFRESH_MS, GLM_TILE_URL, GOES_TIMES_URL, STORAGE_KEY } from "../config.js";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}").lightning || {};
  } catch {
    return {};
  }
}

function saveState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all.lightning = { ...(all.lightning || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function isLightning(r, g, b) {
  const max = r > g ? (r > b ? r : b) : g > b ? g : b;
  const min = r < g ? (r < b ? r : b) : g < b ? g : b;
  if (max - min < 28 || max < 40) return false;
  if (b >= 70 && b >= r + 12) return true;
  if (g >= 80 && b >= 70 && r < 90) return true;
  if (r >= 160 && g >= 60 && b < 90) return true;
  return false;
}

function punchWatermark(data) {
  for (let i = 0; i < data.length; i += 4) {
    if (!isLightning(data[i], data[i + 1], data[i + 2])) data[i + 3] = 0;
  }
}

const GlmTiles = L.TileLayer.extend({
  createTile(coords, done) {
    const tile = document.createElement("canvas");
    const size = this.getTileSize();
    tile.width = size.x;
    tile.height = size.y;
    tile.className = "leaflet-tile";
    this._paint(tile, coords, () => done(null, tile));
    return tile;
  },

  setFrame(time) {
    this._frameTime = time || null;
    for (const key in this._tiles) {
      const rec = this._tiles[key];
      if (rec?.el && rec.coords) this._paint(rec.el, rec.coords);
    }
  },

  _paint(canvas, coords, done) {
    const gen = (canvas._glmGen = (canvas._glmGen || 0) + 1);
    const time = this._frameTime;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!time) {
      done?.();
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.referrerPolicy = "no-referrer";
    img.onload = () => {
      if (canvas._glmGen !== gen) return;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      try {
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        punchWatermark(imageData.data);
        ctx.putImageData(imageData, 0, 0);
      } catch {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      done?.();
    };
    img.onerror = () => {
      if (canvas._glmGen === gen) done?.();
    };
    img.src = L.Util.template(this._url, {
      product: GLM_PRODUCT,
      time: String(time).replace(".", "_"),
      z: coords.z,
      x: coords.x,
      y: coords.y,
    });
  },
});

export function createLightningLayer(map) {
  const saved = loadState();
  let opacity = saved.opacity ?? 0.85;
  let layer = null;
  let timer = null;
  let enabled = false;
  let error = null;
  let onChange = () => {};

  function persist() {
    saveState({ opacity });
  }

  async function latestTime() {
    const res = await fetch(`${GOES_TIMES_URL}?products=${GLM_PRODUCT}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`Lightning times HTTP ${res.status}`);
    const data = await res.json();
    const list = data[GLM_PRODUCT] || [];
    const ts = list[list.length - 1];
    if (!ts) throw new Error("No GLM lightning frames");
    return ts;
  }

  async function ensureLayer() {
    const ts = await latestTime();
    if (layer) {
      layer.setOpacity(opacity);
      layer.setFrame(ts);
      return;
    }
    layer = new GlmTiles(GLM_TILE_URL, {
      opacity,
      pane: "overlayPane",
      className: "lightning-tiles",
      attribution: "GOES GLM © NOAA / CIMSS RealEarth",
      maxZoom: 12,
      maxNativeZoom: 8,
      crossOrigin: true,
      noWrap: true,
    });
    layer.addTo(map);
    layer.setFrame(ts);
  }

  async function refresh() {
    if (!enabled) return;
    try {
      await ensureLayer();
      error = null;
    } catch (err) {
      error = err.message || "Lightning unavailable";
    }
    onChange();
  }

  return {
    id: "lightning",
    name: "Lightning",
    description: "GOES GLM flash extent · last minute",
    color: "#fde047",
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
    enable() {
      enabled = true;
      refresh();
      timer = setInterval(refresh, GLM_REFRESH_MS);
    },
    disable() {
      enabled = false;
      clearInterval(timer);
      timer = null;
      if (layer) {
        map.removeLayer(layer);
        layer = null;
      }
    },
  };
}
