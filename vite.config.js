import { defineConfig } from "vite";

export default defineConfig({
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
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5003,
  },
});
