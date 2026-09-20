/// <reference types="vitest" />
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// GoalNexa frontend. Consumes the platform-core git submodule "in place" —
// main.tsx imports App/registerOrgScopedEntity etc. directly from
// ../platform-core/frontend/src, rather than a copy of that code living
// here (see README.md).
//
// The dev server proxies /api to the backend so the app can use a single
// relative base URL in both dev and prod-like (docker-compose/nginx)
// setups; VITE_API_BASE_URL overrides this if set (see .env.example).
const repoRoot = resolve(__dirname, "..");

export default defineConfig({
  plugins: [react()],
  server: {
    port: 30566,
    // Vite restricts serving files outside the project root by default —
    // platform-core/frontend/src (a sibling of this frontend/ directory,
    // both under the repo root) needs an explicit allow.
    fs: {
      allow: [repoRoot],
    },
    proxy: {
      // platform-core's own backend mounts every feature router under
      // prefix="/api/v1" (see platform-core/backend/app/main.py) — the
      // frontend's request paths (e.g. `/api/v1/auth/login`) ARE the
      // backend's real routes, so this must pass through unchanged, not
      // strip `/api` the way a bare-mounted backend's proxy would. `/health`
      // is the one exception: platform-core mounts it with no prefix at
      // all, so it needs its own explicit rewrite (matches
      // platform-core/nginx/nginx.dev.conf's own two-rule split exactly).
      "/api/health": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: () => "/health",
      },
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
      },
    },
  },
  resolve: {
    // Belt-and-suspenders alongside scripts/link-platform-core-node-modules.mjs's
    // symlink (see that file's own header): forces every resolution of these
    // packages — regardless of which physical node_modules a given import
    // site would otherwise walk up to — to the one copy this project
    // installs. Without this, React loaded twice (once via this project's
    // own node_modules, once via platform-core/frontend's, if the symlink
    // were ever missing) throws the classic "Invalid hook call" crash.
    dedupe: ["react", "react-dom", "react-router-dom", "@tanstack/react-query", "react-hook-form", "zod"],
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./test-setup/setup.ts"],
    css: false,
  },
});
