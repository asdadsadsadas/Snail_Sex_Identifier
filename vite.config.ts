import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// AI Studio injects DISABLE_HMR=true to prevent flickering during agent edits.
const disableHmr = process.env.DISABLE_HMR === "true";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  server: {
    hmr: disableHmr ? false : undefined,
    watch: disableHmr ? null : {},
  },
});
