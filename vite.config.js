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
    },
  },
  preview: {
    host: "0.0.0.0",
    port: 5003,
  },
});
