import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react],
  server: {
    port: 3800,
    host: "127.0.0.1"
  },
  preview: {
    port: 4173,
    host: "127.0.0.1"
  },
  build: {
    target: "es2020",
    sourcemap: false,
    cssCodeSplit: true,
    reportCompressedSize: false,
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react") || id.includes("node_modules/react-dom") || id.includes("node_modules/scheduler")) {
            return "react";
          }
          if (id.includes("node_modules/lucide-react")) {
            return "icons";
          }
        }
      }
    }
  }
});
