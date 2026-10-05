import type { NavEntry, RouteEntry } from "platform-core";

/**
 * Extension point for a build of this app that adds its own pages (e.g. a
 * hosted edition's billing) without editing main's own files: `routes.ts`
 * mounts `createExtensionRoutes()` inside the app-shell layout (signed-in
 * pages), `createExtensionPublicRoutes()` outside it (public pages - a
 * landing page, pricing, legal pages; one with `index: true` replaces
 * main's own `/` redirect), and `app-shell.tsx` appends
 * `createExtensionNavItems()` to the sidebar. Admin pages go in the
 * system console instead: `createExtensionSystemRoutes()` (inside its
 * layout - mount them under `system/`) and
 * `createExtensionSystemNavItems()` (its sidebar - give each link a
 * `permission`, or every signed-in user is let into the console).
 *
 * This is the self-hosted stub - it adds nothing. A downstream build
 * replaces this directory (`app/extensions/`) with its own, keeping these
 * five exports. Code here lives inside main's own tree, so it resolves
 * react/platform-core/etc. from main's node_modules (no dedupe/noExternal
 * entries), and a route's `file` is relative to `app/`
 * (`"extensions/billing.tsx"`).
 *
 * Same rules as a module's route builder: this file is client-bundled
 * (`app-shell.tsx` imports it), so browser-safe - no `node:*`, no `.css`,
 * nothing computed at module load. The five signatures are a contract with
 * downstream builds; change them only deliberately. See root AGENTS.md.
 */
export function createExtensionRoutes(): RouteEntry[] {
  return [];
}

export function createExtensionPublicRoutes(): RouteEntry[] {
  return [];
}

export function createExtensionNavItems(): NavEntry[] {
  return [];
}

export function createExtensionSystemRoutes(): RouteEntry[] {
  return [];
}

export function createExtensionSystemNavItems(): NavEntry[] {
  return [];
}
