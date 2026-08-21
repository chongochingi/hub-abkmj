import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { HOME } from "./config.js";
import { createAircraftLayer } from "./layers/aircraft.js";
import { createNexradLayer } from "./layers/nexrad.js";
import { createMesonetLayer } from "./layers/mesonet.js";
import { createRainfallLayer } from "./layers/rainfall.js";
import { createHazardsLayer } from "./layers/hazards.js";
import { createSatelliteLayer } from "./layers/satellite.js";
import { createLightningLayer } from "./layers/lightning.js";
import { createOutlooksLayer } from "./layers/outlooks.js";
import { createMetarLayer } from "./layers/metar.js";
import { createSoundingsLayer } from "./layers/soundings.js";
import { createRiversLayer } from "./layers/rivers.js";
import { createWildfireLayer } from "./layers/wildfire.js";
import { createAirQualityLayer } from "./layers/airquality.js";
import { createEarthquakesLayer } from "./layers/earthquakes.js";
import { createLakesLayer } from "./layers/lakes.js";
import { createOdotCamerasLayer } from "./layers/odotcameras.js";
import { createBirdnetPanel } from "./layers/birdnet.js";
import { createLayerPanel } from "./ui.js";
import { createTheme } from "./theme.js";
import { startAlertMonitor } from "./alerts.js";

const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
  worldCopyJump: false,
  zoomSnap: 0.25,
  maxBounds: [
    [-85, -180],
    [85, 180],
  ],
  maxBoundsViscosity: 1,
}).setView([HOME.lat, HOME.lon], HOME.zoom);

function applyWorldMinZoom() {
  const { x, y } = map.getSize();
  if (x < 2 || y < 2) return;
  const minZ = Math.max(Math.log2(x / 256), Math.log2(y / 256));
  const snapped = Math.ceil(minZ * 4) / 4;
  map.setMinZoom(snapped);
  if (map.getZoom() < snapped) map.setZoom(snapped);
}

map.whenReady(applyWorldMinZoom);
map.on("resize", applyWorldMinZoom);

L.control.zoom({ position: "bottomright" }).addTo(map);

createTheme(map);

const nexrad = createNexradLayer(map);

createLayerPanel([
  {
    id: "weather",
    name: "Weather",
    color: "#22c55e",
    layers: [
      nexrad,
      createSatelliteLayer(map),
      createRainfallLayer(map),
      createLightningLayer(map),
      createOutlooksLayer(map),
      createHazardsLayer(map, { getRadarIds: () => nexrad.getSelectedSites() }),
      createMesonetLayer(map),
      createMetarLayer(map),
      createSoundingsLayer(map),
    ],
  },
  {
    id: "aircraft",
    name: "Aircraft",
    color: "#38bdf8",
    collapsed: true,
    layers: [createAircraftLayer(map)],
  },
  {
    id: "water",
    name: "Water",
    color: "#0ea5e9",
    collapsed: true,
    layers: [createLakesLayer(map), createRiversLayer(map)],
  },
  {
    id: "fire",
    name: "Fire & air",
    color: "#f97316",
    collapsed: true,
    layers: [createWildfireLayer(map), createAirQualityLayer(map)],
  },
  {
    id: "quakes",
    name: "Earthquakes",
    color: "#f59e0b",
    collapsed: true,
    layers: [createEarthquakesLayer(map)],
  },
  {
    id: "traffic",
    name: "Traffic",
    color: "#38bdf8",
    collapsed: true,
    layers: [createOdotCamerasLayer(map)],
  },
]);

createBirdnetPanel(map);
startAlertMonitor();

document.getElementById("recenter").addEventListener("click", () => {
  map.setView([HOME.lat, HOME.lon], HOME.zoom, { animate: true });
});
