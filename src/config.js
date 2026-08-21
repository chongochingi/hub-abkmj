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
export const NCEP_WMS_BASE = "https://opengeo.ncep.noaa.gov/geoserver";
export const NEXRAD_SITE_PRODUCTS = [
  { id: "bref", label: "Reflectivity", layer: "sr_bref", style: "radar_reflectivity", filter: "reflectivity", iem: "N0B" },
  { id: "bvel", label: "Velocity", layer: "sr_bvel", style: "radar_velocity", filter: "dark", iem: "N0G" },
  { id: "bdhc", label: "Hydrometeors", layer: "bdhc", style: "radar_bdhc", filter: "dark", iem: "N0H" },
  { id: "boha", label: "1-hr precip", layer: "boha", style: "radar_boha", filter: "dark", iem: "DAA" },
  { id: "bdsa", label: "Storm total", layer: "bdsa", style: "radar_bdsa", filter: "dark", iem: "DTA" },
];
export const NEXRAD_REFRESH_MS = 2 * 60 * 1000;
export const NEXRAD_FRAME_MS = 500;
export const NEXRAD_LOOP_OPTIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 360, label: "6 hours" },
];
export const LOOP_SPEED_OPTIONS = [
  { id: 0.5, label: "0.5×" },
  { id: 1, label: "1×" },
  { id: 2, label: "2×" },
  { id: 4, label: "4×" },
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
export const WILDFIRE_AGE_OPTIONS = [
  { hours: 0, label: "Any time" },
  { hours: 12, label: "Past 12 hours" },
  { hours: 24, label: "Past 24 hours" },
  { hours: 72, label: "Past 3 days" },
  { hours: 168, label: "Past 7 days" },
  { hours: 336, label: "Past 14 days" },
  { hours: 720, label: "Past 30 days" },
];

export const MESONET_URL =
  "https://www.mesonet.org/data/public/mesonet/current/current.csv.txt";
export const MESONET_POLL_MS = 5 * 60 * 1000;
export const MESONET_VARS = [
  { id: "wind", label: "Wind" },
  { id: "rain", label: "Rain" },
  { id: "temp", label: "Temp" },
  { id: "humidity", label: "Humidity" },
];

export const MRMS_TILE_BASE =
  "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0";
export const MRMS_PERIODS = [
  { id: "q2-n1p", label: "1 hour" },
  { id: "q2-p24h", label: "24 hours" },
  { id: "q2-p72h", label: "72 hours" },
];
export const MRMS_REFRESH_MS = 5 * 60 * 1000;

export const WARNINGS_URL = "https://mesonet.agron.iastate.edu/geojson/sbw.geojson";
export const STORM_ATTR_URL = "https://mesonet.agron.iastate.edu/geojson/nexrad_attr.geojson";
export const LSR_URL = "https://mesonet.agron.iastate.edu/geojson/lsr.py?hours=12";
export const WATCHES_URL =
  "https://api.weather.gov/alerts/active?event=Tornado%20Watch,Severe%20Thunderstorm%20Watch,Flash%20Flood%20Watch";
export const HAZARD_POLL_MS = 60 * 1000;

export const GOES_TIMES_URL = "https://realearth.ssec.wisc.edu/api/times";
export const GOES_TILE_URL =
  "https://realearth.ssec.wisc.edu/tiles/{product}_{time}/{z}/{x}/{y}.png";
export const GOES_CHANNELS = [
  { id: "vis", label: "Visible", product: "G19-ABI-CONUS-BAND02" },
  { id: "ir", label: "IR", product: "G19-ABI-CONUS-BAND13" },
  { id: "wv", label: "Water vapor", product: "G19-ABI-CONUS-BAND09" },
];
export const GOES_REFRESH_MS = 5 * 60 * 1000;
export const GOES_FRAME_MS = 500;
export const GOES_LOOP_OPTIONS = [
  { minutes: 15, label: "15 min" },
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 360, label: "6 hours" },
];

export const BIRDNET_API = "/api/birdnet";
export const BIRDNET_POLL_MS = 20 * 1000;
export const BIRDNET_HEARTBEAT_MS = 20 * 1000;
export const BIRDNET_RECENT_LIMIT = 20;
export const LIVEATC_PROXY = "/api/liveatc";
export const NWR_PROXY = "/api/nwr";
export const AUDIO_FEEDS = [
  { id: "bird", label: "Yard", kind: "bird" },
  { id: "kokc_twr", label: "KOKC Twr", kind: "atc", mount: "kokc_twr", lat: 35.3931, lon: -97.6007 },
  { id: "koun_twr", label: "Westheimer", kind: "atc", mount: "koun_twr", lat: 35.2456, lon: -97.4721 },
  { id: "ktul1", label: "KTUL", kind: "atc", mount: "ktul1", lat: 36.1984, lon: -95.8881 },
  {
    id: "wxk85",
    label: "WXK85 OKC",
    kind: "nwr",
    mount: "OK-OklahomaCity-WXK85",
    lat: 35.5682,
    lon: -97.4891,
  },
  {
    id: "wxk86",
    label: "WXK86 Lawton",
    kind: "nwr",
    mount: "OK-Lawton-WXK86",
    lat: 34.5922,
    lon: -98.4911,
  },
  {
    id: "kih27",
    label: "KIH27 Tulsa",
    kind: "nwr",
    mount: "OK-Tulsa-KIH27",
    lat: 36.0211,
    lon: -95.6563,
  },
];

export const DEFAULT_LAKE_STATE = "ok";
export const US_STATES = [
  { id: "al", label: "Alabama" },
  { id: "ak", label: "Alaska" },
  { id: "az", label: "Arizona" },
  { id: "ar", label: "Arkansas" },
  { id: "ca", label: "California" },
  { id: "co", label: "Colorado" },
  { id: "ct", label: "Connecticut" },
  { id: "de", label: "Delaware" },
  { id: "dc", label: "District of Columbia" },
  { id: "fl", label: "Florida" },
  { id: "ga", label: "Georgia" },
  { id: "hi", label: "Hawaii" },
  { id: "id", label: "Idaho" },
  { id: "il", label: "Illinois" },
  { id: "in", label: "Indiana" },
  { id: "ia", label: "Iowa" },
  { id: "ks", label: "Kansas" },
  { id: "ky", label: "Kentucky" },
  { id: "la", label: "Louisiana" },
  { id: "me", label: "Maine" },
  { id: "md", label: "Maryland" },
  { id: "ma", label: "Massachusetts" },
  { id: "mi", label: "Michigan" },
  { id: "mn", label: "Minnesota" },
  { id: "ms", label: "Mississippi" },
  { id: "mo", label: "Missouri" },
  { id: "mt", label: "Montana" },
  { id: "ne", label: "Nebraska" },
  { id: "nv", label: "Nevada" },
  { id: "nh", label: "New Hampshire" },
  { id: "nj", label: "New Jersey" },
  { id: "nm", label: "New Mexico" },
  { id: "ny", label: "New York" },
  { id: "nc", label: "North Carolina" },
  { id: "nd", label: "North Dakota" },
  { id: "oh", label: "Ohio" },
  { id: "ok", label: "Oklahoma" },
  { id: "or", label: "Oregon" },
  { id: "pa", label: "Pennsylvania" },
  { id: "ri", label: "Rhode Island" },
  { id: "sc", label: "South Carolina" },
  { id: "sd", label: "South Dakota" },
  { id: "tn", label: "Tennessee" },
  { id: "tx", label: "Texas" },
  { id: "ut", label: "Utah" },
  { id: "vt", label: "Vermont" },
  { id: "va", label: "Virginia" },
  { id: "wa", label: "Washington" },
  { id: "wv", label: "West Virginia" },
  { id: "wi", label: "Wisconsin" },
  { id: "wy", label: "Wyoming" },
];
export const USGS_LAKES_POLL_MS = 15 * 60 * 1000;

export function usgsLakesUrl(stateCd) {
  return `https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=${stateCd}&siteType=LK&parameterCd=62614,62615,00062,00065&siteStatus=active`;
}
export const USACE_POOL_URL =
  "https://cwms-data.usace.army.mil/cwms-data/levels?office=SWT&level-id-mask=*Elev*Top%20of%20Conservation*&page-size=500";
/** Normal / conservation pool elevation (ft) for Oklahoma lakes by USGS site number. */
export const LAKE_NORMAL_POOL_FT = {
  "07159550": 1191, // Hefner
  "07229445": 1191, // Draper
  "07240500": 1242, // Overholser
  "07229900": 1039, // Thunderbird
  "07238500": 1615.4, // Canton
  "07191400": 619, // Hudson
  "07302500": 1559, // Altus
  "07324300": 1642, // Foss
  "07325900": 1342, // Fort Cobb
  "07333900": 577.1, // McGee Creek
  "07190000": 745, // Grand / Lake O' the Cherokees
  "07331455": 615, // Texoma
  "07333010": 590, // Atoka (approx normal)
  "07241588": 1069, // Wes Watkins
  "07241600": 1069, // Shawnee
  "07309500": 1345.5, // Lawtonka
  "07308990": 1235, // Ellsworth
};

/** Map USGS site ids to USACE SWT location codes when names differ. */
export const LAKE_USACE_CODES = {
  "07229900": "THUN",
  "07238500": "CANT",
  "07191400": "HUDS",
  "07302500": "ALTU",
  "07324300": "FOSS",
  "07325900": "FCOB",
  "07333900": "MCGE",
  "07190000": "PENS",
  "07331455": "DENI",
  "07229445": "DRAP",
  "07333010": "ATOK",
};

export const USGS_QUAKE_FEED_BASE =
  "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary";
export const USGS_QUAKE_POLL_MS = 2 * 60 * 1000;
export const USGS_QUAKE_PERIODS = [
  { id: "hour", label: "Past hour" },
  { id: "day", label: "Past day" },
  { id: "week", label: "Past 7 days" },
  { id: "month", label: "Past 30 days" },
];
export const USGS_QUAKE_MAGS = [
  { id: "all", label: "All magnitudes" },
  { id: "2.5", label: "M2.5+" },
  { id: "4.5", label: "M4.5+" },
  { id: "significant", label: "Significant" },
];
export const DEFAULT_QUAKE_PERIOD = "week";
export const DEFAULT_QUAKE_MAG = "2.5";

export const GLM_PRODUCT = "GOESEastGLMFEDRadC";
export const GLM_REFRESH_MS = 60 * 1000;
export const GLM_TILE_URL = "/api/re-tiles/{product}_{time}/{z}/{x}/{y}.png";

export const SPC_OUTLOOK_BASE =
  "https://mapservices.weather.noaa.gov/vector/rest/services/outlooks/SPC_wx_outlks/MapServer";
export const SPC_OUTLOOK_DAYS = [
  { id: "1", label: "Day 1", layer: 1 },
  { id: "2", label: "Day 2", layer: 9 },
  { id: "3", label: "Day 3", layer: 17 },
];
export const SPC_POLL_MS = 5 * 60 * 1000;

export const METAR_URL = "/api/metar";
export const METAR_POLL_MS = 2 * 60 * 1000;
export const METAR_MIN_ZOOM = 6;

export const RIVERS_URL =
  "https://mapservices.weather.noaa.gov/eventdriven/rest/services/water/riv_gauges/MapServer/0/query";
export const RIVERS_POLL_MS = 5 * 60 * 1000;

export const AIRNOW_URL =
  "https://services.arcgis.com/cJ9YHowT8TU7DUyn/arcgis/rest/services/AirNowLatestContoursCombined/FeatureServer/0/query?where=1%3D1&outFields=gridcode,Timestamp&outSR=4326&f=geojson&resultRecordCount=2000";
export const SMOKE_URL =
  "https://services9.arcgis.com/RHVPKKiFTONKtxq3/ArcGIS/rest/services/NDGD_SmokeForecast_v1/FeatureServer/0/query?where=1%3D1&outFields=smoke_classdesc,referencedate&outSR=4326&f=geojson&resultRecordCount=2000";
export const AIR_POLL_MS = 10 * 60 * 1000;

export const RAOB_NETWORK_URL =
  "https://mesonet.agron.iastate.edu/geojson/network.py?network=RAOB";
export const RAOB_JSON_URL = "https://mesonet.agron.iastate.edu/json/raob.py";
/** SPC NSHARP observed Skew-T GIFs (same product as /exper/soundings/). */
export const SPC_SOUNDING_BASE = "https://www.spc.noaa.gov/exper/soundings";
export const RAOB_NEAR_KM = 45;

export const MESONET_STATION_URL = "https://www.mesonet.org/weather/local?stid=";
export const MESONET_METEOGRAM_URL = "https://www.mesonet.org/weather/meteogram?stid=";

export const ODOT_CAMERAS_URL =
  "/api/oktraffic/MapCameras?filter=%7B%22limit%22%3A5000%7D";
export const ODOT_STREAM_URL =
  "/api/oktraffic/MapCameras/{id}/streamDictionary";
export const ODOT_CAMERAS_POLL_MS = 10 * 60 * 1000;

export const STORAGE_KEY = "hub-abkmj-layers";

export const MAP_BASES = {
  regular: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  },
};
