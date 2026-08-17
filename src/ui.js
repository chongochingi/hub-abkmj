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
      if (id.startsWith("_")) continue;
      merged[id] = { ...(current[id] || {}), ...value };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

function saveGroups(groupsState) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all._groups = groupsState;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

function savePanelOpen(open) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all._panel = { ...(all._panel || {}), open };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function createLayerPanel(groups) {
  const list = document.getElementById("layer-list");
  const statusEl = document.getElementById("status");
  const panel = document.getElementById("panel");
  const openBtn = document.getElementById("panel-open");
  const minBtn = document.getElementById("panel-min");
  const state = loadState();
  const groupsState = state._groups || {};
  const cards = new Map();
  const layers = groups.flatMap((g) => g.layers);

  function setOpen(open) {
    panel.hidden = !open;
    openBtn.hidden = open;
    savePanelOpen(open);
  }

  minBtn.addEventListener("click", () => setOpen(false));
  openBtn.addEventListener("click", () => setOpen(true));

  function mountLayer(layer, parent) {
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

    parent.appendChild(card);
    cards.set(layer.id, card);
    layer.onChange(() => render(layer));
    setLayer(layer, enabled, { persist: false });
  }

  for (const group of groups) {
    const collapsed = groupsState[group.id]?.collapsed ?? group.collapsed ?? false;
    const section = document.createElement("section");
    section.className = `source-group${collapsed ? " is-collapsed" : ""}`;
    section.dataset.source = group.id;
    section.innerHTML = `
      <button type="button" class="source-head" aria-expanded="${!collapsed}">
        <span class="source-chevron" aria-hidden="true">▾</span>
        <span class="layer-swatch" style="color:${group.color};background:${group.color}"></span>
        <span class="source-name">${group.name}</span>
        <span class="source-meta"></span>
      </button>
      <div class="source-body"></div>
    `;
    const body = section.querySelector(".source-body");
    const head = section.querySelector(".source-head");
    head.addEventListener("click", () => {
      const next = !section.classList.contains("is-collapsed");
      section.classList.toggle("is-collapsed", next);
      head.setAttribute("aria-expanded", String(!next));
      groupsState[group.id] = { collapsed: next };
      saveGroups(groupsState);
    });
    for (const layer of group.layers) mountLayer(layer, body);
    list.appendChild(section);
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

  if (window.matchMedia("(max-width: 720px)").matches && state._panel?.open == null) {
    setOpen(false);
  } else {
    setOpen(state._panel?.open !== false);
  }
}
