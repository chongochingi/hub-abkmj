# hub.abkmj.com

A single map for live aircraft, NEXRAD radar, and current wildfires. Each overlay can be turned on or off from the layer panel.

## Layers

- **Aircraft** — polled from `atm.abkmj.com` (same feed as ADSB Display). Proxied at `/api/aircraft` because that API does not send CORS headers.
- **NEXRAD radar** — Iowa Environmental Mesonet CONUS base reflectivity tiles, refreshed every 5 minutes. Opacity is adjustable.
- **Wildfires** — current incidents. Tries the ArcGIS URL you supplied first, then falls back to [Esri Living Atlas / NIFC USA Current Wildfires](https://www.arcgis.com/home/item.html?id=d957997ccee7408287a963600a77f61f) if that service 400s.
- **Fire perimeters** — mapped burn outlines from the same Living Atlas service.

Layer on/off state and radar opacity are saved in `localStorage`.

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
