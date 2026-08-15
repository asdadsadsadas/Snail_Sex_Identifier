import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import path from "path";

// AI Studio injects DISABLE_HMR=true to prevent flickering during agent edits.
const disableHmr = process.env.DISABLE_HMR === "true";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Self-signed SSL cert so getUserMedia works on mobile devices
    // (mobile browsers require HTTPS except for localhost)
    basicSsl(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    hmr: disableHmr ? false : undefined,
    watch: disableHmr ? null : {},
    // Proxy API calls through the same HTTPS origin so phones don't hit
    // mixed-content blocking (the app is HTTPS; the API is plain HTTP).
    proxy: {
      "/classify": { target: "http://localhost:8000", changeOrigin: true },
      "/health": { target: "http://localhost:8000", changeOrigin: true },
    },
  },
});
