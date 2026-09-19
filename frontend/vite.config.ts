/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GoalNexa frontend. Dev server proxies /api to the backend so the app can
// use a single relative base URL in both dev and prod-like setups; VITE_API_BASE_URL
// overrides this if set (see .env.example).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 30566,
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test-setup/setup.ts"],
    css: false,
  },
});
