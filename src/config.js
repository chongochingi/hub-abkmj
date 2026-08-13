export const HOME = {
  lat: 35.4676,
  lon: -97.5164,
  zoom: 8,
};

export const AIRCRAFT_URL = "/api/aircraft";
export const AIRCRAFT_POLL_MS = 2000;

export const NEXRAD_PRODUCT = "N0B";
export const NEXRAD_SITES_URL =
  "https://mesonet.agron.iastate.edu/geojson/network.py?network=NEXRAD";
export const NEXRAD_SCANS_URL = "https://mesonet.agron.iastate.edu/json/radar.py";
export const NEXRAD_TILE_BASE =
  "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0";
export const NEXRAD_REFRESH_MS = 5 * 60 * 1000;
export const NEXRAD_FRAME_MS = 500;
export const NEXRAD_LOOP_OPTIONS = [
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
];
export const DEFAULT_RADAR_SITES = ["TLX"];

// Primary URL from the request. The ArcGIS org currently returns "Invalid URL",
// so we fall back to Esri Living Atlas / NIFC current incidents.
export const WILDFIRE_INCIDENT_URLS = [
  "https://services3.arcgis.com/T4QDm6Co9ChOVI83/arcgis/rest/services/Wildfire_Current_Incidents/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson",
  "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=geojson",
];

export const WILDFIRE_PERIMETER_URL =
  "https://services9.arcgis.com/RHVPKKiFTONKtxq3/arcgis/rest/services/USA_Wildfires_v1/FeatureServer/1/query?where=1%3D1&outFields=*&outSR=4326&f=geojson";

export const WILDFIRE_POLL_MS = 5 * 60 * 1000;

export const STORAGE_KEY = "hub-abkmj-layers";
