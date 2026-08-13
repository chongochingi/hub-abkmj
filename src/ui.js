import { STORAGE_KEY } from "./config.js";

function loadState() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveState(state) {
  try {
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    const merged = { ...current };
    for (const [id, value] of Object.entries(state)) {
      merged[id] = { ...(current[id] || {}), ...value };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export function createLayerPanel(layers) {
  const list = document.getElementById("layer-list");
  const statusEl = document.getElementById("status");
  const panel = document.getElementById("panel");
  const openBtn = document.getElementById("panel-open");
  const closeBtn = document.getElementById("panel-close");
  const state = loadState();

  function setOpen(open) {
    panel.hidden = !open;
    openBtn.hidden = open;
  }

  closeBtn.addEventListener("click", () => setOpen(false));
  openBtn.addEventListener("click", () => setOpen(true));

  const cards = new Map();

  for (const layer of layers) {
    const enabled = state[layer.id]?.on ?? layer.defaultOn;
    if (layer.hasOpacity && state[layer.id]?.opacity != null) {
      layer.setOpacity(state[layer.id].opacity);
    }

    const card = document.createElement("div");
    card.className = "layer-card";
    card.innerHTML = `
      <span class="layer-swatch" style="color:${layer.color};background:${layer.color}"></span>
      <div>
        <div class="layer-name">${layer.name}</div>
        <div class="layer-desc">${layer.description}</div>
      </div>
      <div class="layer-meta">
        <button class="toggle" type="button" aria-pressed="false" aria-label="Toggle ${layer.name}"></button>
        <span class="count"></span>
      </div>
    `;

    if (layer.hasOpacity) {
      const row = document.createElement("div");
      row.className = "opacity-row";
      row.innerHTML = `
        <input type="range" min="10" max="90" value="${Math.round(layer.getOpacity() * 100)}" />
        <span class="opacity-val">${Math.round(layer.getOpacity() * 100)}%</span>
      `;
      card.appendChild(row);
      const slider = row.querySelector("input");
      const label = row.querySelector(".opacity-val");
      slider.addEventListener("input", () => {
        const value = Number(slider.value) / 100;
        layer.setOpacity(value);
        label.textContent = `${slider.value}%`;
        state[layer.id] = { ...(state[layer.id] || {}), opacity: value };
        saveState(state);
      });
    }

    if (layer.mountExtras) {
      const extras = document.createElement("div");
      extras.className = "layer-extras";
      card.appendChild(extras);
      layer.mountExtras(extras);
    }

    const toggle = card.querySelector(".toggle");
    toggle.addEventListener("click", () => {
      const next = toggle.getAttribute("aria-pressed") !== "true";
      setLayer(layer, next);
    });

    list.appendChild(card);
    cards.set(layer.id, card);
    layer.onChange(() => render(layer));
    setLayer(layer, enabled, { persist: false });
  }

  function setLayer(layer, on, { persist = true } = {}) {
    const toggle = cards.get(layer.id).querySelector(".toggle");
    const already = toggle.getAttribute("aria-pressed") === "true";
    if (on === already) {
      render(layer);
      return;
    }
    toggle.setAttribute("aria-pressed", String(on));
    if (on) layer.enable();
    else layer.disable();
    state[layer.id] = { ...(state[layer.id] || {}), on };
    if (persist) saveState(state);
    render(layer);
  }

  function render(layer) {
    const card = cards.get(layer.id);
    const count = layer.getCount();
    card.querySelector(".count").textContent = count == null ? "" : String(count);
    updateStatus();
  }

  function updateStatus() {
    const err = layers.map((l) => l.getError?.()).find(Boolean);
    if (err) {
      statusEl.textContent = err;
      statusEl.className = "status err";
      return;
    }
    const aircraft = layers.find((l) => l.id === "aircraft");
    const n = aircraft?.getCount?.() ?? 0;
    statusEl.textContent = `Live · ${n} aircraft`;
    statusEl.className = "status ok";
  }

  if (window.matchMedia("(max-width: 720px)").matches) {
    setOpen(false);
  }
}
