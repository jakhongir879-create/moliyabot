import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Mini App: `npm run build` dist/ papkasini yaratadi, uni backend (3000-port) xizmat qiladi.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true,
    allowedHosts: true,
    proxy: { "/api": "http://localhost:3000" },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
