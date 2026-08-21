import L from "leaflet";
import { ODOT_CAMERAS_URL, ODOT_CAMERAS_POLL_MS } from "../config.js";
import { esc } from "../html.js";

const openWindows = new Map();
let popupOffset = 0;

function openCameraWindow(cam) {
  const name = `odot-cam-${cam.id}`;
  const existing = openWindows.get(cam.id);
  if (existing && !existing.closed) {
    existing.focus();
    return;
  }

  popupOffset = (popupOffset + 32) % 160;
  const params = new URLSearchParams({
    id: String(cam.id),
    title: cam.location || "ODOT Camera",
  });
  const sub = [cam.city, cam.direction ? `facing ${cam.direction}` : ""].filter(Boolean).join(" · ");
  if (sub) params.set("sub", sub);

  const left = 80 + popupOffset;
  const top = 72 + popupOffset;
  const features = [
    "popup=yes",
    "width=720",
    "height=520",
    `left=${left}`,
    `top=${top}`,
    "menubar=no",
    "toolbar=no",
    "location=no",
    "status=no",
    "resizable=yes",
    "scrollbars=no",
  ].join(",");

  const win = window.open(`/odot-camera.html?${params}`, name, features);
  if (!win) return;
  openWindows.set(cam.id, win);
}

function closeAllWindows() {
  for (const win of openWindows.values()) {
    if (win && !win.closed) win.close();
  }
  openWindows.clear();
}

function camIcon(offline = false) {
  const stroke = offline ? "#64748b" : "#38bdf8";
  const fill = offline ? "#64748b" : "#38bdf8";
  return L.divIcon({
    className: "odot-cam-icon",
    html: `<svg viewBox="0 0 20 16" width="20" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2" width="13" height="12" rx="2" fill="#1e293b" stroke="${stroke}" stroke-width="1.5"/>
      <polygon points="14,5 19,3 19,13 14,11" fill="${fill}"/>
    </svg>`,
    iconSize: [20, 16],
    iconAnchor: [10, 8],
    popupAnchor: [0, -10],
  });
}

export function createOdotCamerasLayer(map) {
  let group = null;
  let timer = null;
  let enabled = false;
  let error = null;
  let count = 0;
  let onChange = () => {};

  function buildMarker(cam) {
    const offline = cam.status === "Out Of Service";
    const marker = L.marker([parseFloat(cam.latitude), parseFloat(cam.longitude)], {
      icon: camIcon(offline),
      title: cam.location || "",
      pane: "markerPane",
    });

    const dir = cam.direction ? ` · ${cam.direction}` : "";
    const feedRow = offline
      ? `<div class="popup-row" style="margin-top:8px;color:#64748b">⚠ Camera offline</div>`
      : `<div class="popup-row" style="margin-top:8px">
           <button type="button" class="odot-cam-open-btn" style="all:unset;cursor:pointer;color:var(--cyan);font-size:0.82rem;text-decoration:underline">▶ Open live feed</button>
         </div>`;
    marker.bindPopup(
      `<div class="popup-kicker">ODOT Traffic Camera</div>
       <div class="popup-title">${esc(cam.location || "Camera")}</div>
       <div class="popup-row">${esc(cam.city || "")}${esc(dir)}</div>
       ${feedRow}`,
      { maxWidth: 240 },
    );

    if (!offline) {
      marker.on("popupopen", () => {
        const btn = marker.getPopup()?.getElement()?.querySelector(".odot-cam-open-btn");
        if (btn) {
          btn.onclick = () => {
            marker.closePopup();
            openCameraWindow(cam);
          };
        }
      });
    }

    return marker;
  }

  async function load() {
    const res = await fetch(ODOT_CAMERAS_URL, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`ODOT cameras HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error("Unexpected ODOT response");

    const seen = new Set();
    const cams = data.filter((c) => {
      const lat = parseFloat(c.latitude);
      const lon = parseFloat(c.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon)) return false;
      if (lat === 0 && lon === 0) return false;
      if (seen.has(c.id)) return false;
      seen.add(c.id);
      return true;
    });

    if (group) group.clearLayers();
    for (const cam of cams) group.addLayer(buildMarker(cam));
    count = cams.length;
  }

  async function refresh() {
    if (!enabled) return;
    try {
      await load();
      error = null;
    } catch (err) {
      error = err.message || "ODOT cameras unavailable";
    }
    onChange();
  }

  return {
    id: "odotcameras",
    name: "ODOT Cameras",
    description: "Live traffic cameras · OKtraffic",
    color: "#38bdf8",
    defaultOn: false,
    getCount: () => count || null,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    async enable() {
      enabled = true;
      group = L.layerGroup([], { pane: "markerPane" }).addTo(map);
      await refresh();
      timer = setInterval(refresh, ODOT_CAMERAS_POLL_MS);
    },
    disable() {
      enabled = false;
      clearInterval(timer);
      timer = null;
      if (group) {
        map.removeLayer(group);
        group = null;
      }
      closeAllWindows();
      count = 0;
      error = null;
      onChange();
    },
  };
}
