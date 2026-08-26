# hub.abkmj.com

A single map for live aircraft, RadarScope-class NEXRAD, NWS hazards, GOES, Oklahoma Mesonet, rainfall, and wildfires. The layer panel is grouped by source; click a section header to collapse it.

## Layers

- **Aircraft** — polled from `atm.abkmj.com` (same feed as ADSB Display). Proxied at `/api/aircraft` because that API does not send CORS headers.
- **Radar** — per-site [NWS/NCEP super-resolution](https://opengeo.ncep.noaa.gov/geoserver/www/index.html) NEXRAD: reflectivity, velocity, hydrometeors, 1-hour and storm-total precip. Click sites on the map. Loops prefetch frames so playback stays on-screen.
- **Satellite** — GOES-East CONUS visible, IR, and water vapor ([CIMSS RealEarth](https://realearth.ssec.wisc.edu/)), with the same play / loop / clock controls as radar.
- **Mesonet** — [Oklahoma Mesonet](https://www.mesonet.org/about/data-descriptions/current-observations-csv) wind barbs, rain, temp, humidity.
- **Precipitation** — [MRMS](https://mesonet.agron.iastate.edu/ogc/) 1 / 24 / 72-hour QPE.
- **Hazards** — NWS storm-based warning polygons (IEM), SPC/NWS watches, NEXRAD SCIT storm tracks (for selected radars), and local storm reports.
- **Audio** — right-side panel (minimizable) with collapsible **BirdNET** (yard detections + listen), **ATC** ([LiveATC](https://www.liveatc.net/) KOKC Twr, Max Westheimer / KOUN, KTUL), and **Weather Radio** (WXK85 OKC, WXK86 Lawton, KIH27 Tulsa via [wxradio.org](https://wxradio.org)). LiveATC is proxied through an Icecast metadata stripper at `/api/liveatc/`; NWR is proxied at `/api/nwr/`.
- **Lakes** — Oklahoma [USGS](https://waterdata.usgs.gov/) lake / reservoir stage (gage height or surface elevation).
- **Wildfire** — incidents and burn perimeters together, with a shared recency filter.

Layer on/off state, collapsed sections, and overlay options are saved in `localStorage`.

## Local dev

```bash
cd hub-abkmj
cp .env.example .env   # add your CARTO Basemaps API key
npm install
npm run dev
```

Open http://localhost:5173. Vite proxies `/api/aircraft` to the ATM API.

Basemaps use [CARTO raster tiles](https://carto.com/basemaps) (Voyager / Dark Matter). Set `VITE_CARTO_API_KEY` in `.env` so tiles load without the API watermark.

## Deploy (Docker + Nginx Proxy Manager)

```bash
cp .env.example .env   # if you have not already
docker compose up -d --build
```

Docker passes `VITE_CARTO_API_KEY` from `.env` into the Vite build at image build time.

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
