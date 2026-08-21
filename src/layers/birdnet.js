import L from "leaflet";
import {
  AUDIO_FEEDS,
  BIRDNET_API,
  BIRDNET_HEARTBEAT_MS,
  BIRDNET_POLL_MS,
  BIRDNET_RECENT_LIMIT,
  LIVEATC_PROXY,
  NWR_PROXY,
  STORAGE_KEY,
} from "../config.js";

function esc(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function csrfToken() {
  const match = document.cookie.match(/(?:^|; )csrf=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : "";
}

async function bnFetch(path, options = {}) {
  const headers = { Accept: "application/json", ...(options.headers || {}) };
  const csrf = csrfToken();
  if (csrf) headers["X-CSRF-Token"] = csrf;
  return fetch(`${BIRDNET_API}${path}`, {
    ...options,
    headers,
    credentials: "include",
  });
}

async function bnJson(path, options = {}) {
  const res = await bnFetch(path, options);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `BirdNET HTTP ${res.status}`);
  }
  return data;
}

function fmtWhen(ts) {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return ts || "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function pct(confidence) {
  const n = Number(confidence);
  if (!Number.isFinite(n)) return "";
  return `${Math.round(n * 100)}%`;
}

function detectionId(d) {
  return d?.id ?? d?.ID ?? d?.detectionId;
}

function publicDetection(d) {
  if (!d || typeof d !== "object") return d;
  return {
    id: detectionId(d),
    commonName: d.commonName,
    scientificName: d.scientificName,
    confidence: d.confidence,
    timestamp: d.timestamp || d.beginTime,
    sourceName: d.source?.displayName || d.sourceName || "Yard",
  };
}

function loadPanelState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")._birdnet || {};
  } catch {
    return {};
  }
}

function savePanelState(partial) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all._birdnet = { ...(all._birdnet || {}), ...partial };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function feedById(id) {
  return AUDIO_FEEDS.find((f) => f.id === id) || AUDIO_FEEDS[0];
}

function clampHighpassHz(value, fallback = 1000) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(8000, Math.max(20, Math.round(n)));
}

export function createBirdnetPanel(map) {
  const panel = document.getElementById("birdnet-panel");
  const openBtn = document.getElementById("birdnet-open");
  const minBtn = document.getElementById("birdnet-min");
  const body = document.getElementById("birdnet-body");
  const statusEl = document.getElementById("birdnet-status");
  const subEl = document.getElementById("birdnet-sub");

  let detections = [];
  let error = null;
  let pollTimer = null;
  let sse = null;
  let listenTimer = null;
  let hls = null;
  let listening = false;
  let streamToken = null;
  let sourceId = null;
  let sourceName = "Yard";
  let feed = feedById(loadPanelState().feed);
  let highpassOn = loadPanelState().highpass !== false;
  let audioCtx = null;
  let mediaSource = null;
  let highpassNodes = [];
  const HIGHPASS_OFF_HZ = 10;
  let highpassHz = clampHighpassHz(loadPanelState().highpassHz, 1000);

  const clipAudio = new Audio();
  clipAudio.preload = "none";
  const saved = loadPanelState();
  const groupsState = saved.groups || {};
  const atcFeeds = AUDIO_FEEDS.filter((f) => f.kind === "atc");
  const nwrFeeds = AUDIO_FEEDS.filter((f) => f.kind === "nwr");

  function groupCollapsed(id, fallback) {
    return groupsState[id]?.collapsed ?? fallback;
  }

  function feedChips(feeds) {
    return feeds
      .map((f) => `<button type="button" class="meso-chip" data-feed="${esc(f.id)}">${esc(f.label)}</button>`)
      .join("");
  }

  body.innerHTML = `
    <section class="source-group${groupCollapsed("bird", false) ? " is-collapsed" : ""}" data-audio-group="bird">
      <button type="button" class="source-head" aria-expanded="${!groupCollapsed("bird", false)}">
        <span class="source-chevron" aria-hidden="true">▾</span>
        <span class="layer-swatch" style="color:#a3e635;background:#a3e635"></span>
        <span class="source-name">BirdNET</span>
      </button>
      <div class="source-body">
        <div class="bn-live">
          <button type="button" class="meso-chip bn-listen" data-kind="bird">Listen</button>
          <span class="bn-meta radar-hint"></span>
        </div>
        <label class="check-row bn-highpass">
          <input type="checkbox" class="bn-highpass-input" />
          Filter
          <button type="button" class="bn-hz-step" data-delta="-50" aria-label="Decrease cutoff 50 Hz">−</button>
          <input
            type="number"
            class="bn-highpass-hz"
            min="20"
            max="8000"
            step="50"
            inputmode="numeric"
            aria-label="High-pass cutoff in hertz"
          />
          <button type="button" class="bn-hz-step" data-delta="50" aria-label="Increase cutoff 50 Hz">+</button>
          Hz and below
        </label>
        <div class="bn-list"></div>
      </div>
    </section>
    <section class="source-group${groupCollapsed("atc", false) ? " is-collapsed" : ""}" data-audio-group="atc">
      <button type="button" class="source-head" aria-expanded="${!groupCollapsed("atc", false)}">
        <span class="source-chevron" aria-hidden="true">▾</span>
        <span class="layer-swatch" style="color:#38bdf8;background:#38bdf8"></span>
        <span class="source-name">ATC</span>
      </button>
      <div class="source-body">
        <div class="meso-vars bn-feeds" data-feed-group="atc">
          ${feedChips(atcFeeds)}
        </div>
        <div class="bn-live">
          <button type="button" class="meso-chip bn-listen" data-kind="atc">Listen</button>
          <span class="bn-atc-meta radar-hint"></span>
        </div>
      </div>
    </section>
    <section class="source-group${groupCollapsed("nwr", false) ? " is-collapsed" : ""}" data-audio-group="nwr">
      <button type="button" class="source-head" aria-expanded="${!groupCollapsed("nwr", false)}">
        <span class="source-chevron" aria-hidden="true">▾</span>
        <span class="layer-swatch" style="color:#fbbf24;background:#fbbf24"></span>
        <span class="source-name">Weather Radio</span>
      </button>
      <div class="source-body">
        <div class="meso-vars bn-feeds" data-feed-group="nwr">
          ${feedChips(nwrFeeds)}
        </div>
        <div class="bn-live">
          <button type="button" class="meso-chip bn-listen" data-kind="nwr">Listen</button>
          <span class="bn-nwr-meta radar-hint"></span>
        </div>
      </div>
    </section>
    <audio class="bn-player"></audio>
  `;

  const birdListenBtn = body.querySelector('.bn-listen[data-kind="bird"]');
  const atcListenBtn = body.querySelector('.bn-listen[data-kind="atc"]');
  const nwrListenBtn = body.querySelector('.bn-listen[data-kind="nwr"]');
  const highpassInput = body.querySelector(".bn-highpass-input");
  const highpassHzInput = body.querySelector(".bn-highpass-hz");
  const player = body.querySelector(".bn-player");
  const list = body.querySelector(".bn-list");
  const meta = body.querySelector(".bn-meta");
  const atcMeta = body.querySelector(".bn-atc-meta");
  const nwrMeta = body.querySelector(".bn-nwr-meta");
  player.crossOrigin = "anonymous";
  highpassInput.checked = highpassOn;
  highpassHzInput.value = String(highpassHz);

  let feedMarker = null;

  function feedIcon(label, color) {
    return L.divIcon({
      className: "atc-map-icon",
      html: `<div class="atc-map-pin" title="${esc(label)}">
        <svg viewBox="0 0 24 24" width="22" height="22" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" fill="#0f172a" stroke="${color}" stroke-width="1.5"/>
          <path d="M12 5v14M5 12h14" stroke="${color}" stroke-width="1.5" stroke-linecap="round"/>
        </svg>
        <span class="atc-map-label" style="color:${color};border-color:${color}66">${esc(label)}</span>
      </div>`,
      iconSize: [88, 28],
      iconAnchor: [44, 14],
    });
  }

  function updateFeedMarker() {
    if (feedMarker) {
      map.removeLayer(feedMarker);
      feedMarker = null;
    }
    const pinKind = feed.kind === "atc" || feed.kind === "nwr";
    if (!listening || !pinKind || feed.lat == null || feed.lon == null) return;
    const color = feed.kind === "nwr" ? "#fbbf24" : "#38bdf8";
    feedMarker = L.marker([feed.lat, feed.lon], {
      icon: feedIcon(feed.label, color),
      zIndexOffset: 900,
      interactive: false,
    }).addTo(map);
  }

  function highpassCutoff() {
    return highpassOn && feed.kind === "bird" ? highpassHz : HIGHPASS_OFF_HZ;
  }

  function applyHighpass() {
    if (!audioCtx || !highpassNodes.length) return;
    const hz = highpassCutoff();
    const now = audioCtx.currentTime;
    for (const node of highpassNodes) {
      node.frequency.cancelScheduledValues(now);
      node.frequency.setValueAtTime(hz, now);
    }
  }

  function ensureAudioGraph() {
    if (audioCtx) {
      applyHighpass();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    player.crossOrigin = "anonymous";
    audioCtx = new Ctx();
    mediaSource = audioCtx.createMediaElementSource(player);
    highpassNodes = [0, 1, 2].map(() => {
      const node = audioCtx.createBiquadFilter();
      node.type = "highpass";
      node.frequency.value = highpassCutoff();
      node.Q.value = Math.SQRT1_2;
      return node;
    });
    mediaSource.connect(highpassNodes[0]);
    highpassNodes[0].connect(highpassNodes[1]);
    highpassNodes[1].connect(highpassNodes[2]);
    highpassNodes[2].connect(audioCtx.destination);
  }

  async function resumeAudioGraph() {
    ensureAudioGraph();
    if (audioCtx?.state === "suspended") await audioCtx.resume();
    applyHighpass();
  }

  function setOpen(open) {
    panel.hidden = !open;
    openBtn.hidden = open;
    savePanelState({ open });
  }

  function feedLabel() {
    return feed.kind === "bird" ? sourceName : feed.label;
  }

  function setStatus() {
    if (error) {
      statusEl.textContent = error;
      statusEl.className = "status err";
      return;
    }
    statusEl.textContent = listening
      ? `Live · ${feedLabel()}`
      : feed.kind === "atc"
        ? "LiveATC"
        : feed.kind === "nwr"
          ? "Weather Radio"
          : "Live detections";
    statusEl.className = "status ok";
    openBtn.textContent = listening ? `${feed.label} · live` : "Audio";
  }

  function persistListenUi() {
    const birdOn = listening && feed.kind === "bird";
    const atcOn = listening && feed.kind === "atc";
    const nwrOn = listening && feed.kind === "nwr";
    birdListenBtn.textContent = birdOn ? "Stop" : "Listen";
    birdListenBtn.classList.toggle("is-on", birdOn);
    atcListenBtn.textContent = atcOn ? "Stop" : "Listen";
    atcListenBtn.classList.toggle("is-on", atcOn);
    nwrListenBtn.textContent = nwrOn ? "Stop" : "Listen";
    nwrListenBtn.classList.toggle("is-on", nwrOn);
    body.querySelectorAll("[data-feed]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.feed === feed.id);
    });
    if (atcMeta) atcMeta.textContent = feed.kind === "atc" ? feed.label : "LiveATC.net";
    if (nwrMeta) nwrMeta.textContent = feed.kind === "nwr" ? feed.label : "NOAA Weather Radio";
    updateFeedMarker();
    setStatus();
  }

  function renderList() {
    if (subEl) subEl.textContent = "Yard · ATC · NWR";
    if (meta) meta.textContent = `${detections.length} recent`;
    if (atcMeta) atcMeta.textContent = feed.kind === "atc" ? feed.label : "LiveATC.net";
    if (nwrMeta) nwrMeta.textContent = feed.kind === "nwr" ? feed.label : "NOAA Weather Radio";
    if (!detections.length) {
      list.innerHTML = `<div class="radar-hint">No recent detections</div>`;
      return;
    }
    list.innerHTML = detections
      .map((d) => {
        const img = d.scientificName
          ? `${BIRDNET_API}/media/image/${encodeURIComponent(d.scientificName)}`
          : "";
        return `
          <button type="button" class="bn-row" data-clip="${esc(d.id ?? "")}">
            ${img ? `<img class="bn-thumb" alt="" src="${img}" />` : `<span class="bn-thumb bn-thumb-empty"></span>`}
            <span class="bn-row-text">
              <span class="bn-name">${esc(d.commonName || d.scientificName || "Unknown")}</span>
              <span class="bn-when">${fmtWhen(d.timestamp)} · ${pct(d.confidence)}</span>
            </span>
          </button>`;
      })
      .join("");
    list.querySelectorAll("img.bn-thumb").forEach((img) => {
      img.addEventListener("error", () => {
        img.classList.add("bn-thumb-empty");
        img.removeAttribute("src");
      });
    });
  }

  function mergeDetection(raw) {
    const d = publicDetection(raw);
    if (!d?.commonName && !d?.scientificName) return;
    detections = [d, ...detections.filter((x) => x.id !== d.id)].slice(0, BIRDNET_RECENT_LIMIT);
    renderList();
  }

  async function loadRecent() {
    const data = await bnJson(`/detections/recent?limit=${BIRDNET_RECENT_LIMIT}`);
    const rows = Array.isArray(data) ? data : data?.detections || [];
    detections = rows.map(publicDetection).filter((d) => d?.commonName || d?.scientificName);
    renderList();
  }

  async function loadSource() {
    const data = await bnJson("/streams/sources");
    const sources = data?.sources || [];
    const preferred =
      sources.find((s) => s.state === "running") ||
      sources.find((s) => s.type === "rtsp") ||
      sources[0];
    if (preferred) {
      sourceId = preferred.id;
      sourceName = preferred.name || "Yard";
    }
  }

  function openSse() {
    closeSse();
    sse = new EventSource(`${BIRDNET_API}/detections/stream`);
    const onEvent = (event) => {
      try {
        const payload = JSON.parse(event.data);
        mergeDetection(payload.detection || payload.data || payload);
      } catch {
        /* keepalives */
      }
    };
    sse.addEventListener("detection", onEvent);
    sse.addEventListener("pending", onEvent);
    sse.onmessage = onEvent;
  }

  function closeSse() {
    sse?.close();
    sse = null;
  }

  function stopClips() {
    clipAudio.pause();
    clipAudio.removeAttribute("src");
    clipAudio.load();
  }

  async function stopAllAudio() {
    stopClips();
    if (listening) await stopListen();
    else persistListenUi();
  }

  async function stopListen() {
    listening = false;
    clearInterval(listenTimer);
    listenTimer = null;
    if (hls) {
      hls.destroy();
      hls = null;
    }
    player.onerror = null;
    player.pause();
    player.removeAttribute("src");
    player.load();
    if (streamToken && sourceId) {
      try {
        await bnJson(`/streams/hls/${encodeURIComponent(sourceId)}/stop`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stream_token: streamToken }),
        });
      } catch {
        /* expired */
      }
    }
    streamToken = null;
    persistListenUi();
  }

  async function startBirdListen() {
    await bnJson("/ping");
    if (!sourceId) await loadSource();
    if (!sourceId) throw new Error("No BirdNET audio source");
    const started = await bnJson(`/streams/hls/${encodeURIComponent(sourceId)}/start`, {
      method: "POST",
    });
    streamToken = started.stream_token;
    const playlist = String(started.playlist_url || "").replace(/^\/api\/v2\//, `${BIRDNET_API}/`);
    if (!playlist) throw new Error("BirdNET did not return a playlist");

    await resumeAudioGraph();
    const { default: Hls } = await import("hls.js");
    if (Hls.isSupported()) {
      hls = new Hls({ enableWorker: true, lowLatencyMode: true });
      hls.loadSource(playlist);
      hls.attachMedia(player);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        applyHighpass();
        player.play().catch(() => {});
      });
      hls.on(Hls.Events.ERROR, (_evt, data) => {
        if (data?.fatal) {
          error = "Live audio interrupted";
          setStatus();
        }
      });
    } else if (player.canPlayType("application/vnd.apple.mpegurl")) {
      player.src = playlist;
      await resumeAudioGraph();
      await player.play();
    } else {
      throw new Error("This browser cannot play the live stream");
    }

    listenTimer = setInterval(() => {
      if (!streamToken) return;
      bnJson("/streams/hls/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stream_token: streamToken }),
      }).catch(() => {});
    }, BIRDNET_HEARTBEAT_MS);
  }

  async function startStreamListen() {
    const mount = String(feed.mount || "").replace(/[^A-Za-z0-9_-]/g, "");
    if (!mount) throw new Error(`Unknown ${feed.kind === "nwr" ? "weather radio" : "LiveATC"} feed`);
    const base = feed.kind === "nwr" ? NWR_PROXY : LIVEATC_PROXY;
    const url = `${base}/${mount}?t=${Date.now()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const probe = await fetch(url, {
        method: "GET",
        cache: "no-store",
        signal: controller.signal,
        headers: { Range: "bytes=0-1" },
      });
      if (!probe.ok && probe.status !== 206) {
        throw new Error(`${feed.label} is offline right now`);
      }
      await probe.body?.cancel?.();
    } catch (err) {
      if (err.name === "AbortError") throw new Error(`${feed.label} timed out`);
      throw err.message?.includes(feed.label) ? err : new Error(`${feed.label} is offline right now`);
    } finally {
      clearTimeout(timer);
    }
    player.src = url;
    player.load();
    if (mediaSource) applyHighpass();
    await player.play();
    player.onerror = () => {
      error = `${feed.label} interrupted`;
      stopListen();
      setStatus();
    };
  }

  async function startListen() {
    if (feed.kind === "atc" || feed.kind === "nwr") await startStreamListen();
    else await startBirdListen();
    listening = true;
    persistListenUi();
  }

  async function setFeed(id) {
    const next = feedById(id);
    if (next.id === feed.id) return;
    const wasListening = listening;
    if (wasListening) await stopListen();
    feed = next;
    savePanelState({
      feed: feed.id,
      ...(feed.kind === "atc" ? { atcFeed: feed.id } : {}),
      ...(feed.kind === "nwr" ? { nwrFeed: feed.id } : {}),
    });
    renderList();
    persistListenUi();
    if (wasListening) {
      try {
        await startListen();
        error = null;
      } catch (err) {
        error = err.message || "Live audio unavailable";
        await stopListen();
      }
      setStatus();
    }
  }

  async function toggleListen(kind) {
    try {
      if (listening && feed.kind === kind) {
        await stopListen();
        error = null;
      } else {
        if (kind === "bird" && feed.kind !== "bird") await setFeed("bird");
        else if (kind === "atc" && feed.kind !== "atc") {
          await setFeed(loadPanelState().atcFeed || atcFeeds[0]?.id || "kokc_twr");
        } else if (kind === "nwr" && feed.kind !== "nwr") {
          await setFeed(loadPanelState().nwrFeed || nwrFeeds[0]?.id || "wxk85");
        }
        if (!listening) await startListen();
        error = null;
      }
    } catch (err) {
      error = err.message || "Live audio unavailable";
      await stopListen();
    }
    setStatus();
  }

  birdListenBtn.addEventListener("click", () => toggleListen("bird"));
  atcListenBtn.addEventListener("click", () => toggleListen("atc"));
  nwrListenBtn.addEventListener("click", () => toggleListen("nwr"));

  highpassInput.addEventListener("change", () => {
    highpassOn = highpassInput.checked;
    savePanelState({ highpass: highpassOn });
    if (listening && feed.kind === "bird") {
      ensureAudioGraph();
      if (audioCtx?.state === "suspended") audioCtx.resume();
    }
    applyHighpass();
  });

  function commitHighpassHz(raw, persist) {
    const next = clampHighpassHz(raw, highpassHz);
    highpassHz = next;
    if (document.activeElement !== highpassHzInput) {
      highpassHzInput.value = String(next);
    }
    if (persist) {
      highpassHzInput.value = String(next);
      savePanelState({ highpassHz: next });
    }
    applyHighpass();
  }

  highpassHzInput.addEventListener("input", () => {
    if (highpassHzInput.value === "") return;
    commitHighpassHz(highpassHzInput.value, false);
  });
  highpassHzInput.addEventListener("change", () => {
    commitHighpassHz(highpassHzInput.value, true);
  });
  highpassHzInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitHighpassHz(highpassHzInput.value, true);
      highpassHzInput.blur();
    }
  });

  body.querySelectorAll(".bn-hz-step").forEach((btn) => {
    btn.addEventListener("click", () => {
      const delta = Number(btn.dataset.delta) || 0;
      commitHighpassHz(highpassHz + delta, true);
    });
  });

  body.querySelectorAll(".bn-feeds").forEach((group) => {
    group.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-feed]");
      if (btn) setFeed(btn.dataset.feed);
    });
  });

  body.querySelectorAll("[data-audio-group]").forEach((section) => {
    const head = section.querySelector(".source-head");
    const id = section.dataset.audioGroup;
    head.addEventListener("click", () => {
      const next = !section.classList.contains("is-collapsed");
      section.classList.toggle("is-collapsed", next);
      head.setAttribute("aria-expanded", String(!next));
      groupsState[id] = { collapsed: next };
      savePanelState({ groups: groupsState });
    });
  });

  list.addEventListener("click", (event) => {
    const row = event.target.closest("[data-clip]");
    const id = row?.dataset.clip;
    if (!id) return;
    clipAudio.src = `${BIRDNET_API}/media/audio?id=${encodeURIComponent(id)}`;
    clipAudio.play().catch(() => {});
  });

  document.getElementById("audio-off")?.addEventListener("click", () => {
    stopAllAudio();
  });

  minBtn.addEventListener("click", () => setOpen(false));
  openBtn.addEventListener("click", () => setOpen(true));
  setOpen(loadPanelState().open !== false);
  persistListenUi();

  (async () => {
    try {
      await bnJson("/ping");
      await loadSource();
      await loadRecent();
      openSse();
      error = null;
    } catch (err) {
      error = err.message || "BirdNET unavailable";
    }
    setStatus();
    pollTimer = setInterval(() => {
      loadRecent().catch((err) => {
        error = err.message || "BirdNET unavailable";
        setStatus();
      });
    }, BIRDNET_POLL_MS);
  })();
}
