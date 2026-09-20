import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Admin Panel /admin/ manzilida ishlaydi: http://localhost:3000/admin
export default defineConfig({
  base: "/admin/",
  plugins: [react()],
  server: {
    port: 5174,
    proxy: { "/api": "http://localhost:3000" },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
});
