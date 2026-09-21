import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [reactRouter()],
  resolve: {
    tsconfigPaths: true,
    // Local `file:` package deps (e.g. platform-auth-frontend) ship their
    // own node_modules with their own react/react-dom copy - without this,
    // Vite resolves each package's import of "react" to its own nearest
    // copy, loading two React instances and crashing with "invalid hook
    // call" the moment a package's component actually renders. `dedupe`
    // forces every resolution of these names to this app's own copy.
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    // Treat this as ordinary project source (processed by the react
    // plugin), not a pre-built dependency to pre-bundle - it's TS/TSX
    // source, not compiled JS.
    exclude: ["platform-auth-frontend"],
  },
  ssr: {
    // `resolve.dedupe` only affects Vite's client bundle graph - SSR by
    // default externalizes node_modules packages to plain Node `require`,
    // which resolves symlinks to their REAL path and walks up THAT
    // directory's own ancestry for "react", never finding this app's copy
    // (platform-auth-frontend lives under a sibling apps/ dir, not a real
    // ancestor). Forcing these into Vite's own SSR bundle instead makes
    // dedupe apply to them too. Without this: "Invalid hook call" from
    // inside the package's own react-hook-form usage, not obviously
    // pointing at the real cause.
    noExternal: ["platform-auth-frontend", "react-hook-form", "@hookform/resolvers"],
  },
});
