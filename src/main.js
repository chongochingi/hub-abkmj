import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "./style.css";
import { HOME } from "./config.js";
import { createAircraftLayer } from "./layers/aircraft.js";
import { createNexradLayer } from "./layers/nexrad.js";
import {
  createWildfireIncidentsLayer,
  createWildfirePerimetersLayer,
} from "./layers/wildfire.js";
import { createLayerPanel } from "./ui.js";

const map = L.map("map", {
  zoomControl: false,
  attributionControl: true,
}).setView([HOME.lat, HOME.lon], HOME.zoom);

L.control.zoom({ position: "bottomright" }).addTo(map);

L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd",
  maxZoom: 20,
}).addTo(map);

const layers = [
  createAircraftLayer(map),
  createNexradLayer(map),
  createWildfireIncidentsLayer(map),
  createWildfirePerimetersLayer(map),
];

createLayerPanel(layers);

document.getElementById("recenter").addEventListener("click", () => {
  map.setView([HOME.lat, HOME.lon], HOME.zoom, { animate: true });
});
