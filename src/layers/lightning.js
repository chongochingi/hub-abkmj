import L from "leaflet";
import {
  LIGHTNING_RETENTION_MS,
  LIGHTNING_RETENTION_OPTIONS,
  LIGHTNING_WS,
  STORAGE_KEY,
} from "../config.js";

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

/** Blitzortung frames are LZW-compressed JSON strings. */
function decodeFrame(raw) {
  const d = String(raw).split("");
  let c = d[0];
  let f = c;
  const g = [c];
  const e = {};
  let o = 256;
  for (let i = 1; i < d.length; i++) {
    let a = d[i].charCodeAt(0);
    a = a < 256 ? d[i] : e[a] || f + c;
    g.push(a);
    c = a.charAt(0);
    e[o] = f + c;
    o += 1;
    f = a;
  }
  return g.join("");
}

function strikeTimeMs(s) {
  const t = Number(s?.time);
  if (!Number.isFinite(t) || t <= 0) return Date.now();
  if (t > 1e15) return Math.round(t / 1e6);
  if (t > 1e12) return Math.round(t);
  return Date.now();
}

function ageStyle(ageMs, retentionMs, opacity) {
  const t = Math.min(1, Math.max(0, ageMs / retentionMs));
  let r;
  let g;
  let b;
  let a;
  if (t < 0.08) {
    r = 255;
    g = 255;
    b = 255;
    a = 0.95;
  } else if (t < 0.25) {
    r = 253;
    g = 224;
    b = 71;
    a = 0.9;
  } else if (t < 0.5) {
    r = 251;
    g = 146;
    b = 60;
    a = 0.75;
  } else if (t < 0.75) {
    r = 249;
    g = 115;
    b = 22;
    a = 0.55;
  } else {
    r = 148;
    g = 163;
    b = 184;
    a = 0.35;
  }
  return `rgba(${r},${g},${b},${(a * opacity).toFixed(3)})`;
}

function retentionFromSaved(saved) {
  const minutes = Number(saved?.minutes);
  const opt = LIGHTNING_RETENTION_OPTIONS.find((o) => o.minutes === minutes);
  return opt ? opt.minutes * 60 * 1000 : LIGHTNING_RETENTION_MS;
}

/** Simple bolt path in local coords centered on (0,0), pointing down. */
function boltPath(ctx, x, y, scale) {
  ctx.beginPath();
  ctx.moveTo(x - 1.2 * scale, y - 5.5 * scale);
  ctx.lineTo(x + 2.2 * scale, y - 5.5 * scale);
  ctx.lineTo(x + 0.4 * scale, y - 0.8 * scale);
  ctx.lineTo(x + 2.8 * scale, y - 0.8 * scale);
  ctx.lineTo(x - 1.6 * scale, y + 5.5 * scale);
  ctx.lineTo(x - 0.1 * scale, y + 0.6 * scale);
  ctx.lineTo(x - 2.6 * scale, y + 0.6 * scale);
  ctx.closePath();
}

const StrikeCanvas = L.Layer.extend({
  initialize(options) {
    L.setOptions(this, options);
    this._strikes = [];
    this._flash = [];
    this._retentionMs = options.retentionMs || LIGHTNING_RETENTION_MS;
    this._opacity = options.opacity ?? 0.9;
    this._raf = null;
    this._ageTimer = null;
    this._onNeedRedraw = this._scheduleDraw.bind(this);
  },

  onAdd(map) {
    this._map = map;
    this._canvas = L.DomUtil.create("canvas", "lightning-canvas");
    this._ctx = this._canvas.getContext("2d");
    map.getContainer().appendChild(this._canvas);
    this._reset();
    map.on("move zoom viewreset resize", this._onNeedRedraw);
    this._ageTimer = setInterval(() => {
      if (this._strikes.length) this._scheduleDraw();
    }, 5000);
    this._scheduleDraw();
  },

  onRemove(map) {
    cancelAnimationFrame(this._raf);
    this._raf = null;
    clearInterval(this._ageTimer);
    this._ageTimer = null;
    map.off("move zoom viewreset resize", this._onNeedRedraw);
    L.DomUtil.remove(this._canvas);
    this._map = null;
  },

  setRetention(ms) {
    this._retentionMs = ms;
    this._prune(Date.now());
    this._scheduleDraw();
  },

  setOpacity(value) {
    this._opacity = value;
    this._scheduleDraw();
  },

  addStrike(lat, lon, timeMs) {
    const t = timeMs || Date.now();
    this._strikes.push({ lat, lon, t });
    this._flash.push({ lat, lon, t: performance.now() });
    if (this._strikes.length > 25000) {
      this._strikes.splice(0, this._strikes.length - 20000);
    }
    this._scheduleDraw();
  },

  getCount() {
    return this._strikes.length;
  },

  clear() {
    this._strikes.length = 0;
    this._flash.length = 0;
    this._scheduleDraw();
  },

  _prune(now) {
    const cut = now - this._retentionMs;
    const first = this._strikes.findIndex((s) => s.t >= cut);
    if (first > 0) this._strikes.splice(0, first);
    else if (first < 0) this._strikes.length = 0;
  },

  _reset() {
    if (!this._map || !this._canvas) return;
    const size = this._map.getSize();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this._canvas.width = Math.round(size.x * dpr);
    this._canvas.height = Math.round(size.y * dpr);
    this._canvas.style.width = `${size.x}px`;
    this._canvas.style.height = `${size.y}px`;
    this._ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  },

  _scheduleDraw() {
    if (this._raf || !this._map) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this._reset();
      this._draw();
      if (this._flash.length) this._scheduleDraw();
    });
  },

  _draw() {
    if (!this._map || !this._canvas) return;
    const map = this._map;
    const ctx = this._ctx;
    const size = map.getSize();
    const now = Date.now();
    const perf = performance.now();
    const retention = this._retentionMs;
    const opacity = this._opacity;
    this._prune(now);
    ctx.clearRect(0, 0, size.x, size.y);

    const pad = 14;
    for (let i = 0; i < this._strikes.length; i++) {
      const s = this._strikes[i];
      const age = now - s.t;
      if (age < 0 || age > retention) continue;
      const pt = map.latLngToContainerPoint([s.lat, s.lon]);
      if (pt.x < -pad || pt.y < -pad || pt.x > size.x + pad || pt.y > size.y + pad) continue;
      const scale = age < retention * 0.1 ? 1.15 : age < retention * 0.4 ? 1 : 0.85;
      boltPath(ctx, pt.x, pt.y, scale);
      ctx.fillStyle = ageStyle(age, retention, opacity);
      ctx.fill();
    }

    const FLASH_MS = 1800;
    this._flash = this._flash.filter((f) => perf - f.t <= FLASH_MS);
    for (const f of this._flash) {
      const age = perf - f.t;
      const p = age / FLASH_MS;
      const pt = map.latLngToContainerPoint([f.lat, f.lon]);
      if (pt.x < -40 || pt.y < -40 || pt.x > size.x + 40 || pt.y > size.y + 40) continue;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 3 + p * 16, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(254, 240, 138, ${((1 - p) * 0.55 * opacity).toFixed(3)})`;
      ctx.lineWidth = 1.25;
      ctx.stroke();
    }
  },
});

export function createLightningLayer(map) {
  const saved = loadState();
  let opacity = saved.opacity ?? 0.9;
  let retentionMs = retentionFromSaved(saved);

  let layer = null;
  let enabled = false;
  let error = null;
  let onChange = () => {};
  let extrasRoot = null;
  let ws = null;
  let wsIdx = 0;
  let reconnectTimer = null;
  let countTimer = null;
  let count = 0;

  function persist() {
    const minutes =
      LIGHTNING_RETENTION_OPTIONS.find((o) => o.minutes * 60 * 1000 === retentionMs)?.minutes ?? 15;
    saveState({ opacity, minutes });
  }

  function renderExtras() {
    if (!extrasRoot) return;
    extrasRoot.querySelectorAll("[data-minutes]").forEach((btn) => {
      const ms = Number(btn.dataset.minutes) * 60 * 1000;
      btn.classList.toggle("is-on", ms === retentionMs);
    });
  }

  function setStatus() {
    const next = layer?.getCount() ?? 0;
    if (next === count && !error) return;
    count = next;
    onChange();
  }

  function connect() {
    disconnect(false);
    const url = LIGHTNING_WS[wsIdx % LIGHTNING_WS.length];
    let socket;
    try {
      socket = new WebSocket(url);
    } catch {
      scheduleReconnect();
      return;
    }
    ws = socket;
    error = null;
    onChange();
    socket.onopen = () => {
      error = null;
      onChange();
      try {
        socket.send(JSON.stringify({ a: 111 }));
      } catch {
        /* closed */
      }
    };
    socket.onmessage = (event) => {
      try {
        const s = JSON.parse(decodeFrame(event.data));
        if (typeof s?.lat !== "number" || typeof s?.lon !== "number") return;
        if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) return;
        if (Math.abs(s.lat) > 90 || Math.abs(s.lon) > 180) return;
        layer?.addStrike(s.lat, s.lon, strikeTimeMs(s));
      } catch {
        /* keepalives / non-strike frames */
      }
    };
    socket.onerror = () => {
      try {
        socket.close();
      } catch {
        /* ignore */
      }
    };
    socket.onclose = () => {
      if (!enabled) return;
      error = "Lightning reconnecting…";
      onChange();
      scheduleReconnect();
    };
  }

  function scheduleReconnect() {
    clearTimeout(reconnectTimer);
    wsIdx += 1;
    reconnectTimer = setTimeout(() => {
      if (enabled) connect();
    }, 2000);
  }

  function disconnect(clearError = true) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
    if (ws) {
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
      ws = null;
    }
    if (clearError) error = null;
  }

  return {
    id: "lightning",
    name: "Lightning",
    description: "Live strikes · white = newest",
    color: "#fde047",
    defaultOn: false,
    hasOpacity: true,
    getOpacity: () => opacity,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    setOpacity(value) {
      opacity = value;
      persist();
      layer?.setOpacity(opacity);
    },
    mountExtras(container) {
      extrasRoot = container;
      container.innerHTML = `
        <div class="meso-vars">
          ${LIGHTNING_RETENTION_OPTIONS.map(
            (o) =>
              `<button type="button" class="meso-chip" data-minutes="${o.minutes}">${o.label}</button>`,
          ).join("")}
        </div>
      `;
      renderExtras();
      container.addEventListener("click", (event) => {
        const btn = event.target.closest("[data-minutes]");
        if (!btn) return;
        retentionMs = Number(btn.dataset.minutes) * 60 * 1000;
        persist();
        layer?.setRetention(retentionMs);
        renderExtras();
        setStatus();
      });
    },
    enable() {
      enabled = true;
      if (!layer) {
        layer = new StrikeCanvas({ retentionMs, opacity });
      } else {
        layer.clear();
        layer.setRetention(retentionMs);
        layer.setOpacity(opacity);
      }
      layer.addTo(map);
      connect();
      countTimer = setInterval(setStatus, 5000);
      setStatus();
    },
    disable() {
      enabled = false;
      clearInterval(countTimer);
      countTimer = null;
      disconnect(true);
      if (layer) {
        map.removeLayer(layer);
        layer.clear();
      }
      count = 0;
      onChange();
    },
  };
}
