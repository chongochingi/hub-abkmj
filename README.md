# hub.abkmj.com

A single map for live aircraft, RadarScope-class NEXRAD, NWS hazards, GOES, Oklahoma Mesonet, rainfall, and wildfires. The layer panel is grouped by source; click a section header to collapse it.

## Layers

- **Aircraft** — polled from `atm.abkmj.com` (same feed as ADSB Display). Proxied at `/api/aircraft` because that API does not send CORS headers.
- **Radar** — per-site [NWS/NCEP super-resolution](https://opengeo.ncep.noaa.gov/geoserver/www/index.html) NEXRAD: reflectivity, velocity, hydrometeors, 1-hour and storm-total precip. Click sites on the map. Loops prefetch frames so playback stays on-screen.
- **Satellite** — GOES-East CONUS visible, IR, and water vapor ([CIMSS RealEarth](https://realearth.ssec.wisc.edu/)), with the same play / loop / clock controls as radar.
- **Mesonet** — [Oklahoma Mesonet](https://www.mesonet.org/about/data-descriptions/current-observations-csv) wind barbs, rain, temp, humidity.
- **Precipitation** — [MRMS](https://mesonet.agron.iastate.edu/ogc/) 1 / 24 / 72-hour QPE.
- **Hazards** — NWS storm-based warning polygons (IEM), SPC/NWS watches, NEXRAD SCIT storm tracks (for selected radars), and local storm reports.
- **Audio** — right-side panel (minimizable) with collapsible **BirdNET** (yard detections + listen) and **ATC** ([LiveATC](https://www.liveatc.net/) KOKC Twr, Max Westheimer / KOUN, KTUL). LiveATC is proxied through an Icecast metadata stripper at `/api/liveatc/` so browsers can play it.
- **Lakes** — Oklahoma [USGS](https://waterdata.usgs.gov/) lake / reservoir stage (gage height or surface elevation).
- **Wildfire** — incidents and burn perimeters together, with a shared recency filter.

Layer on/off state, collapsed sections, and overlay options are saved in `localStorage`.

## Local dev

```bash
cd hub-abkmj
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/aircraft` to the ATM API.

## Deploy (Docker + Nginx Proxy Manager)

```bash
docker compose up -d --build
```

That publishes the app on **port 5003** and joins `infra_default` so NPM can reach the container as `hub-abkmj`.

In Nginx Proxy Manager:

1. Add Proxy Host `hub.abkmj.com`
2. Scheme **http**, Forward Hostname/IP **`192.168.0.184`** (hostname only — do not include `http://`), Forward Port **`5003`**
3. Request an SSL certificate (Let's Encrypt)
4. Force SSL

Putting `http://192.168.0.184` in the hostname field makes nginx build `http://http://192.168.0.184:5003` and return 500.

Wildcard DNS for `*.abkmj.com` already points here, so no Porkbun change is required.

Rebuild after code changes:

```bash
docker compose up -d --build
```
