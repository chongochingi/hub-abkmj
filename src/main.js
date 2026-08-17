import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { HOME } from "./config.js";
import { createAircraftLayer } from "./layers/aircraft.js";
import { createNexradLayer } from "./layers/nexrad.js";
import { createMesonetLayer } from "./layers/mesonet.js";
import { createRainfallLayer } from "./layers/rainfall.js";
import { createWarningsLayer } from "./layers/warnings.js";
import { createWatchesLayer } from "./layers/watches.js";
import { createStormTracksLayer } from "./layers/storms.js";
import { createLsrLayer } from "./layers/lsr.js";
import { createSatelliteLayer } from "./layers/satellite.js";
import { createWildfireLayer } from "./layers/wildfire.js";
import { createLakesLayer } from "./layers/lakes.js";
import { createBirdnetPanel } from "./layers/birdnet.js";
import { createLayerPanel } from "./ui.js";
import { createTheme } from "./theme.js";

const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
}).setView([HOME.lat, HOME.lon], HOME.zoom);

L.control.zoom({ position: "bottomright" }).addTo(map);

createTheme(map);

const nexrad = createNexradLayer(map);

createLayerPanel([
  {
    id: "aircraft",
    name: "Aircraft",
    color: "#38bdf8",
    layers: [createAircraftLayer(map)],
  },
  {
    id: "radar",
    name: "Radar",
    color: "#22c55e",
    layers: [nexrad],
  },
  {
    id: "satellite",
    name: "Satellite",
    color: "#c4b5fd",
    collapsed: true,
    layers: [createSatelliteLayer(map)],
  },
  {
    id: "obs",
    name: "Mesonet",
    color: "#38bdf8",
    collapsed: true,
    layers: [createMesonetLayer(map)],
  },
  {
    id: "precip",
    name: "Precipitation",
    color: "#6366f1",
    collapsed: true,
    layers: [createRainfallLayer(map)],
  },
  {
    id: "hazards",
    name: "Hazards",
    color: "#ef4444",
    collapsed: true,
    layers: [
      createWarningsLayer(map),
      createWatchesLayer(map),
      createStormTracksLayer(map, { getRadarIds: () => nexrad.getSelectedSites() }),
      createLsrLayer(map),
    ],
  },
  {
    id: "lakes",
    name: "Lakes",
    color: "#0ea5e9",
    collapsed: true,
    layers: [createLakesLayer(map)],
  },
  {
    id: "fire",
    name: "Wildfire",
    color: "#f97316",
    collapsed: true,
    layers: [createWildfireLayer(map)],
  },
]);

createBirdnetPanel();

document.getElementById("recenter").addEventListener("click", () => {
  map.setView([HOME.lat, HOME.lon], HOME.zoom, { animate: true });
});
