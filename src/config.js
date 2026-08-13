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
  { minutes: 30, label: "30 min" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
];

export const BIRDNET_API = "/api/birdnet";
export const BIRDNET_POLL_MS = 20 * 1000;
export const BIRDNET_HEARTBEAT_MS = 20 * 1000;
export const BIRDNET_RECENT_LIMIT = 20;
export const LIVEATC_PROXY = "/api/liveatc";
export const AUDIO_FEEDS = [
  { id: "bird", label: "Yard", kind: "bird" },
  { id: "kokc_twr", label: "KOKC Twr", kind: "atc", mount: "kokc_twr" },
  { id: "koun_twr", label: "Westheimer", kind: "atc", mount: "koun_twr" },
  { id: "ktul1", label: "KTUL", kind: "atc", mount: "ktul1" },
];

export const USGS_LAKES_URL =
  "https://waterservices.usgs.gov/nwis/iv/?format=json&stateCd=ok&siteType=LK&parameterCd=62614,62615,00062,00065&siteStatus=active";
export const USGS_LAKES_POLL_MS = 15 * 60 * 1000;
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

export const STORAGE_KEY = "hub-abkmj-layers";
