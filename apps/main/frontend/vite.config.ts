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
    // "react-router" joined this list once platform-org-frontend's own
    // route modules (routes/orgs*.tsx) started importing it directly
    // (useOutletContext, etc.) - without dedupe, that import resolves to
    // ITS OWN nested react-router copy, a different module instance than
    // this app's, so `useOutletContext()` inside those files would read
    // from a context object app-shell.tsx's `<Outlet context={...}>`
    // never touches - "must be used within a data router" or a silently
    // wrong (undefined) value, not an obvious crash pointing at the
    // real cause.
    dedupe: ["react", "react-dom", "react-router"],
  },
  optimizeDeps: {
    // Treat these as ordinary project source (processed by the react
    // plugin), not pre-built dependencies to pre-bundle - they're TS/TSX
    // source, not compiled JS.
    exclude: ["platform-auth-frontend", "platform-org-frontend", "platform-core"],
  },
  ssr: {
    // `resolve.dedupe` only affects Vite's client bundle graph - SSR by
    // default externalizes node_modules packages to plain Node `require`,
    // which resolves symlinks to their REAL path and walks up THAT
    // directory's own ancestry for "react", never finding this app's copy
    // (these packages live under sibling apps/ dirs, not a real
    // ancestor). Forcing these into Vite's own SSR bundle instead makes
    // dedupe apply to them too. Without this: "Invalid hook call" from
    // inside a package's own react-hook-form usage, not obviously
    // pointing at the real cause. Every module's screen package that
    // uses react-hook-form needs to be listed here.
    noExternal: [
      "platform-auth-frontend",
      "platform-org-frontend",
      "platform-core",
      "react-hook-form",
      "@hookform/resolvers",
    ],
  },
});
