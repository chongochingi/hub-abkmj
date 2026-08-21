import {
  HOME,
  WARNINGS_URL,
  WILDFIRE_INCIDENT_URLS,
  USGS_QUAKE_FEED_BASE,
} from "./config.js";
import { distanceToFeatureKm, haversineKm } from "./geo.js";
import { esc } from "./html.js";

const POLL_MS = 60 * 1000;
const SEEN_KEY = "hub-abkmj-alerts-seen";
const MAX_TOASTS = 4;
const TOAST_MS = 20000;

const QUAKE_NEAR_KM = 120;
const QUAKE_NEAR_MAG = 3.0;
const QUAKE_SIGNIFICANT_MAG = 4.5;

const FIRE_NEAR_KM = 100;
const FIRE_CLOSE_KM = 35;
const FIRE_ACRES_MIN = 50;

const WARN_NEAR_KM = 150;
const WARN_CODES = new Set(["TO", "SV", "FF"]);

function loadSeen() {
  try {
    const raw = sessionStorage.getItem(SEEN_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeen(seen) {
  try {
    const list = [...seen].slice(-200);
    sessionStorage.setItem(SEEN_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

function getStack() {
  let stack = document.getElementById("alert-stack");
  if (stack) return stack;
  stack = document.createElement("div");
  stack.id = "alert-stack";
  stack.className = "alert-stack";
  stack.setAttribute("aria-live", "polite");
  document.body.appendChild(stack);
  return stack;
}

function showToast({ id, kind, title, body, onClick }) {
  const seen = loadSeen();
  if (seen.has(id)) return;
  seen.add(id);
  saveSeen(seen);

  const stack = getStack();
  while (stack.children.length >= MAX_TOASTS) {
    stack.firstChild?.remove();
  }

  const toast = document.createElement("div");
  toast.className = `alert-toast alert-${kind}`;
  toast.innerHTML = `
    <div class="alert-toast-kind">${esc(kind)}</div>
    <div class="alert-toast-title">${esc(title)}</div>
    <div class="alert-toast-body">${esc(body)}</div>
    <button type="button" class="alert-toast-close" aria-label="Dismiss">✕</button>
  `;

  const dismiss = () => toast.remove();
  toast.querySelector(".alert-toast-close").addEventListener("click", dismiss);
  toast.addEventListener("click", (e) => {
    if (e.target.closest(".alert-toast-close")) return;
    onClick?.();
    dismiss();
  });

  stack.appendChild(toast);
  setTimeout(dismiss, TOAST_MS);
}

async function fetchJson(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function checkQuakes() {
  fetchJson(`${USGS_QUAKE_FEED_BASE}/2.5_day.geojson`)
    .then((data) => {
      for (const f of data.features || []) {
        const p = f.properties || {};
        const mag = Number(p.mag);
        if (!Number.isFinite(mag)) continue;
        const [lon, lat] = f.geometry?.coordinates || [];
        if (lat == null || lon == null) continue;
        const km = haversineKm(HOME.lat, HOME.lon, lat, lon);
        const significant = mag >= QUAKE_SIGNIFICANT_MAG || (mag >= QUAKE_NEAR_MAG && km <= QUAKE_NEAR_KM);
        if (!significant) continue;
        const id = `quake-${p.id || p.time}`;
        showToast({
          id,
          kind: "Earthquake",
          title: `M${mag.toFixed(1)} · ${p.place || "Unknown"}`,
          body: km <= QUAKE_NEAR_KM ? `${Math.round(km)} km away` : `${Math.round(km)} km from home`,
          onClick: () => {
            if (p.url) window.open(p.url, "_blank", "noopener");
          },
        });
      }
    })
    .catch(() => {});
}

function checkWildfires() {
  fetchJson(WILDFIRE_INCIDENT_URLS[0])
    .then((data) => {
      for (const f of data.features || []) {
        const props = f.properties || {};
        const pt = f.geometry?.coordinates;
        if (!pt || pt.length < 2) continue;
        const [lon, lat] = pt;
        const km = haversineKm(HOME.lat, HOME.lon, lat, lon);
        const acres = Number(
          props.DailyAcres ?? props.CalculatedAcres ?? props.GISAcres ?? props.IncidentSize ?? 0,
        );
        const nearby =
          km <= FIRE_CLOSE_KM || (km <= FIRE_NEAR_KM && acres >= FIRE_ACRES_MIN);
        if (!nearby) continue;
        const name = props.IncidentName || props.incident_name || "Wildfire";
        const id = `fire-${props.irwinID || props.objectId || name}-${lat}-${lon}`;
        showToast({
          id,
          kind: "Wildfire",
          title: name,
          body: `${Math.round(km)} km away${acres ? ` · ${Math.round(acres).toLocaleString()} ac` : ""}`,
        });
      }
    })
    .catch(() => {});
}

const WARN_NAMES = {
  TO: "Tornado Warning",
  SV: "Severe Thunderstorm Warning",
  FF: "Flash Flood Warning",
};

function checkWarnings() {
  fetchJson(WARNINGS_URL)
    .then((data) => {
      for (const f of data.features || []) {
        const props = f.properties || {};
        const code = props.phenomena;
        if (!WARN_CODES.has(code)) continue;
        const km = distanceToFeatureKm(HOME.lat, HOME.lon, f);
        if (km > WARN_NEAR_KM) continue;
        const id = `warn-${props.wfo || ""}-${code}-${props.issue || props.expire || props.expire_utc || km}`;
        showToast({
          id,
          kind: "Storm",
          title: WARN_NAMES[code] || props.ps || "Storm Warning",
          body: `${Math.round(km)} km away · until ${props.expire || props.expire_utc || "—"}`,
        });
      }
    })
    .catch(() => {});
}

function tick() {
  checkQuakes();
  checkWildfires();
  checkWarnings();
}

export function startAlertMonitor() {
  tick();
  return setInterval(tick, POLL_MS);
}
