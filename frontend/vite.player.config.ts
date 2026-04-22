import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
  define: {
    // API_BASE fallback — standalone assets use relative paths, never hits the backend
    "process.env.NEXT_PUBLIC_API_URL": JSON.stringify(""),
  },
  publicDir: false,
  build: {
    outDir: "player-dist",
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "player-entry.tsx"),
      name: "TellanaPlayer",
      formats: ["iife"],
      fileName: () => "player-bundle.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: (assetInfo) =>
          assetInfo.name?.endsWith(".css") ? "player-bundle.css" : (assetInfo.name ?? "asset"),
      },
    },
  },
});
