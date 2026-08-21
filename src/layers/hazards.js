import { STORAGE_KEY } from "../config.js";
import { createWarningsLayer } from "./warnings.js";
import { createWatchesLayer } from "./watches.js";
import { createStormTracksLayer } from "./storms.js";
import { createLsrLayer } from "./lsr.js";

const KINDS = [
  { id: "warnings", label: "Warnings", fallbackOn: true },
  { id: "watches", label: "Watches", fallbackOn: true },
  { id: "storms", label: "Storm tracks", fallbackOn: true },
  { id: "lsr", label: "Storm reports", fallbackOn: false },
];

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function loadKinds() {
  const all = loadAll();
  const saved = all.hazards?.kinds || {};
  const kinds = {};
  for (const kind of KINDS) {
    kinds[kind.id] =
      saved[kind.id] ?? all[kind.id]?.on ?? kind.fallbackOn;
  }
  return kinds;
}

function saveKinds(kinds) {
  try {
    const all = loadAll();
    all.hazards = { ...(all.hazards || {}), kinds };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    /* ignore */
  }
}

export function createHazardsLayer(map, { getRadarIds } = {}) {
  const kinds = loadKinds();
  const parts = {
    warnings: createWarningsLayer(map),
    watches: createWatchesLayer(map),
    storms: createStormTracksLayer(map, { getRadarIds }),
    lsr: createLsrLayer(map),
  };
  const live = new Set();
  let extrasRoot = null;
  let enabled = false;
  let onChange = () => {};

  for (const part of Object.values(parts)) {
    part.onChange(() => onChange());
  }

  function persist() {
    saveKinds(kinds);
  }

  function setPart(id, on) {
    const part = parts[id];
    if (on) {
      if (!live.has(id)) {
        part.enable();
        live.add(id);
      }
      return;
    }
    if (live.has(id)) {
      part.disable();
      live.delete(id);
    }
  }

  function apply() {
    for (const kind of KINDS) setPart(kind.id, enabled && kinds[kind.id]);
  }

  function renderExtras() {
    if (!extrasRoot) return;
    extrasRoot.querySelectorAll("[data-hazard]").forEach((input) => {
      input.checked = Boolean(kinds[input.dataset.hazard]);
    });
  }

  return {
    id: "hazards",
    name: "Hazards",
    description: "Warnings · watches · tracks · reports",
    color: "#ef4444",
    defaultOn: KINDS.some((kind) => kinds[kind.id]),
    getCount: () =>
      KINDS.reduce((sum, kind) => sum + (kinds[kind.id] ? parts[kind.id].getCount() || 0 : 0), 0),
    getError: () => KINDS.map((kind) => (live.has(kind.id) ? parts[kind.id].getError?.() : null)).find(Boolean) || null,
    onChange(fn) {
      onChange = fn;
    },
    mountExtras(container) {
      extrasRoot = container;
      container.innerHTML = `
        <div class="hazard-checks">
          ${KINDS.map(
            (kind) => `
              <label class="check-row">
                <input type="checkbox" data-hazard="${kind.id}" ${kinds[kind.id] ? "checked" : ""} />
                ${kind.label}
              </label>
            `,
          ).join("")}
        </div>
      `;
      container.addEventListener("change", (event) => {
        const input = event.target.closest("[data-hazard]");
        if (!input) return;
        kinds[input.dataset.hazard] = input.checked;
        persist();
        apply();
        onChange();
      });
      renderExtras();
    },
    enable() {
      enabled = true;
      apply();
    },
    disable() {
      enabled = false;
      apply();
    },
  };
}
