import { createSystemNavItems, isNavGroup, type NavEntry } from "platform-core";
import { createRbacNavItems, filterNavByPermissions } from "platform-auth-frontend";
import { createOrgAdminNavItem } from "platform-org-frontend";
import { createExtensionSystemNavItems } from "../extensions";

/**
 * The system console's sidebar (`routes/system-shell.tsx`) - every
 * instance-wide admin page, mounted under `/system` in routes.ts with the
 * same base path. Each link carries its permission, so `consoleNav`
 * filtered by a user's permissions is what they may open; nothing left =
 * not an admin. A function, not a constant: JSX icons are created when
 * called (browser-safe like any nav builder).
 */
export function createSystemConsoleNav(): NavEntry[] {
  return [
    ...createSystemNavItems("system", [createOrgAdminNavItem("system")]),
    ...createRbacNavItems("system"),
    ...createExtensionSystemNavItems(),
  ];
}

/** The console pages `permissions` allow (`null` while loading = none). */
export function allowedConsoleNav(permissions: string[] | null): NavEntry[] {
  return permissions ? filterNavByPermissions(createSystemConsoleNav(), permissions) : [];
}

/** Where "System console" lands: the first page the user may open, or null for a non-admin. */
export function consoleHome(permissions: string[] | null): string | null {
  const first = allowedConsoleNav(permissions)[0];
  if (!first) return null;
  return isNavGroup(first) ? (first.children[0]?.to ?? null) : first.to;
}
