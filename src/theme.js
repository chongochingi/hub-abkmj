import L from "leaflet";
import { MAP_BASES, STORAGE_KEY } from "./config.js";

function loadTheme() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")._theme;
    return saved === "dark" ? "dark" : "regular";
  } catch {
    return "regular";
  }
}

function saveTheme(mode) {
  try {
    const all = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    all._theme = mode;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore quota */
  }
}

export function createTheme(map) {
  let mode = loadTheme();
  const base = MAP_BASES[mode] || MAP_BASES.regular;
  const tiles = L.tileLayer(base.url, {
    attribution: base.attribution,
    subdomains: "abcd",
    maxZoom: 20,
  }).addTo(map);

  function renderToggle() {
    const root = document.getElementById("theme-toggle");
    if (!root) return;
    root.querySelectorAll("[data-theme]").forEach((btn) => {
      btn.classList.toggle("is-on", btn.dataset.theme === mode);
    });
  }

  function apply(next) {
    mode = next === "dark" ? "dark" : "regular";
    const spec = MAP_BASES[mode];
    tiles.setUrl(spec.url);
    tiles.options.attribution = spec.attribution;
    document.documentElement.dataset.theme = mode;
    saveTheme(mode);
    renderToggle();
  }

  apply(mode);

  const root = document.getElementById("theme-toggle");
  if (root) {
    root.innerHTML = `
      <button type="button" class="meso-chip" data-theme="regular">Regular</button>
      <button type="button" class="meso-chip" data-theme="dark">Dark</button>
    `;
    root.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-theme]");
      if (btn) apply(btn.dataset.theme);
    });
    renderToggle();
  }

  return { getMode: () => mode, setMode: apply };
}
