import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        odotCamera: resolve(__dirname, "odot-camera.html"),
        sounding: resolve(__dirname, "sounding.html"),
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5173,
    allowedHosts: ["hub.abkmj.com", "localhost"],
    proxy: {
      "/api/aircraft": {
        target: "https://atm.abkmj.com",
        changeOrigin: true,
        rewrite: () => "/api/data",
        secure: true,
      },
      "/api/birdnet": {
        target: "http://127.0.0.1:8085",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/birdnet/, "/api/v2"),
      },
      "/api/liveatc": {
        target: "http://127.0.0.1:8091",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/liveatc/, ""),
      },
      "/api/nwr": {
        target: "https://wxradio.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/nwr/, ""),
      },
      "/api/metar": {
        target: "https://aviationweather.gov",
        changeOrigin: true,
        secure: true,
        rewrite: () => "/api/data/metar",
      },
      "/api/oktraffic": {
        target: "https://oktraffic.org",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/oktraffic/, "/api"),
      },
      "/api/re-tiles": {
        target: "https://realearth.ssec.wisc.edu",
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/re-tiles/, "/tiles"),
        configure: (proxy) => {
          proxy.on("proxyReq", (proxyReq) => {
            proxyReq.removeHeader("referer");
            proxyReq.removeHeader("origin");
          });
        },
      },
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5003,
  },
});
