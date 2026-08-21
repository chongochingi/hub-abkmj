import L from "leaflet";
import { loadRaobSites, openSkewTWindow, plotStationId } from "../sounding.js";

export function createSoundingsLayer(map) {
  const group = L.layerGroup();
  let count = 0;
  let error = null;
  let onChange = () => {};
  let loaded = false;

  async function draw() {
    try {
      const sites = await loadRaobSites();
      group.clearLayers();
      for (const site of sites) {
        const marker = L.circleMarker([site.lat, site.lon], {
          radius: 6,
          color: "#c4b5fd",
          fillColor: "#8b5cf6",
          fillOpacity: 0.9,
          weight: 1.5,
        }).bindTooltip(`${site.id} · ${site.name}`, { direction: "top" });
        marker.on("click", () => {
          openSkewTWindow(site.id, { title: `${plotStationId(site.id)} · ${site.name}` });
        });
        marker.addTo(group);
      }
      count = sites.length;
      error = null;
      loaded = true;
    } catch (err) {
      error = err.message || "Sounding sites unavailable";
    }
    onChange();
  }

  return {
    id: "soundings",
    name: "Soundings",
    description: "RAOB sites · click for Skew-T",
    color: "#8b5cf6",
    defaultOn: false,
    getCount: () => count,
    getError: () => error,
    onChange(fn) {
      onChange = fn;
    },
    enable() {
      group.addTo(map);
      if (!loaded) draw();
    },
    disable() {
      map.removeLayer(group);
    },
  };
}
