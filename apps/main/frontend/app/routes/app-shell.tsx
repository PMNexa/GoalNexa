import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router";
import { AnnouncementBanner, AppShell, defineMessages, translator, useLocale, useT } from "platform-core";
import type { NavEntry } from "platform-core";
import {
  endImpersonation,
  filterNavByPermissions,
  getSession,
  logout,
  subscribeSession,
  useMyPermissions,
} from "platform-auth-frontend";
import { createMcpNavItems } from "platform-mcp-frontend";
import { createOrgsNavItems } from "platform-org-frontend";
import { createExtensionNavItems } from "../extensions";
import { DashboardIcon, GoalsIcon, TableIcon, TeamsIcon } from "../lib/navIcons";
import { ShellLink } from "../lib/ShellLink";
import { useRequireAccessToken } from "../lib/useRequireAccessToken";
import { useUserMenu } from "../lib/useUserMenu";

// Modules with their own route builder bring their own entries
// (`createOrgsNavItems`, `createMcpNavItems`), given
// the SAME base path routes.ts mounts them at. Plain literals remain for
// resources mounted with a bare `createCrudRoutes` (goals, metrics,
// check-ins). A `permission` link shows only when the user has it
// (`filterNavByPermissions`) - the API enforces it either way; this just
// hides pages that would 403. Groups (`children`) collapse; AppShell
// remembers which are closed. Instance-wide admin pages (users, roles,
// system) aren't here: they're the system console's (system-shell.tsx),
// linked from the user menu. See root AGENTS.md.
// Built per render (labels in the current language - `useLocale` below
// re-renders the shell on a switch).
const messages = defineMessages({
  en: {
    dashboard: "Dashboard",
    table: "Check-in table",
    board: "Team board",
    tracking: "Goal tracking",
    goals: "Goals",
    cycles: "Cycles",
    templates: "Goal templates",
    metrics: "Metrics",
    checkIns: "Check-ins",
    reminders: "Reminders",
    viewingAs: (v: { name: string; email: string }) => (
      <>
        Viewing as <strong>{v.name}</strong> ({v.email}) - read-only, ends in 15 minutes.
      </>
    ),
    stopViewing: "Stop viewing",
  },
  vi: {
    dashboard: "Bảng điều khiển",
    table: "Bảng check-in",
    board: "Bảng nhóm",
    tracking: "Theo dõi mục tiêu",
    goals: "Mục tiêu",
    cycles: "Chu kỳ",
    templates: "Mẫu mục tiêu",
    metrics: "Chỉ số",
    checkIns: "Check-in",
    reminders: "Nhắc nhở",
    viewingAs: (v: { name: string; email: string }) => (
      <>
        Đang xem với tư cách <strong>{v.name}</strong> ({v.email}) - chỉ đọc, kết thúc sau 15 phút.
      </>
    ),
    stopViewing: "Dừng xem",
  },
});

function navItems(): NavEntry[] {
  const t = translator(messages);
  return [
    { label: t("dashboard"), to: "/dashboard", icon: DashboardIcon },
    { label: t("table"), to: "/table", icon: TableIcon },
    { label: t("board"), to: "/board", icon: TeamsIcon, permission: "goal-templates.view" },
    {
      label: t("tracking"),
      icon: GoalsIcon,
      children: [
        { label: t("goals"), to: "/goals" },
        { label: t("cycles"), to: "/cycles" },
        { label: t("templates"), to: "/goal-templates", permission: "goal-templates.view" },
        { label: t("metrics"), to: "/metrics" },
        { label: t("checkIns"), to: "/check-ins" },
        { label: t("reminders"), to: "/reminders" },
      ],
    },
    ...createOrgsNavItems("platform-org"),
    ...createMcpNavItems("mcp"),
    ...createExtensionNavItems(),
  ];
}

/**
 * Wraps every screen except login/signup (see routes.ts) with platform-
 * core's AppShell (sidemenu + sticky header). Owns the pieces AppShell
 * deliberately doesn't: the router Link, the nav item list (spans multiple
 * modules' routes, so it can't live in any one module's package), and the
 * session read.
 *
 * Also the ONE place every route nested under this layout gets gated on
 * having a session (`useRequireAccessToken` redirects to login once
 * that's definitely absent) - every generic CRUD resource's own route
 * files live in `platform-core` now (see `routes.ts`), so they have no
 * session-reading logic of their own to duplicate this in, so it moved
 * up to the one layout that actually needs it. The gated token is
 * handed down via `<Outlet context={accessToken}>` - `platform-core`'s
 * `crud-list.tsx`/`crud-new.tsx`/`crud-detail.tsx`/`crud-edit.tsx` (and
 * goalnexa-frontend's `dashboard.tsx`, platform-mcp-frontend's `mcp.tsx`) read it with
 * `useOutletContext<string>()`.
 *
 * The header's user block is a dropdown: switch organization / manage
 * organizations (`useUserMenu`), then "Log out" - platform-auth's
 * `logout()`: revokes the refresh token server-side, then clears the
 * session (which redirects to login via
 * `useRequireAccessToken`). Until then the session never ends on its
 * own - platform-auth's session store keeps the access token fresh.
 */
export default function AppShellLayout() {
  const location = useLocation();
  const t = useT(messages);
  useLocale();
  const [session, setSessionState] = useState(() => getSession());
  const accessToken = useRequireAccessToken();
  const permissions = useMyPermissions();
  const nav = filterNavByPermissions(navItems(), permissions);
  const userMenu = useUserMenu(accessToken, permissions);

  useEffect(() => {
    return subscribeSession(() => setSessionState(getSession()));
  }, []);

  if (accessToken === null) return null;

  return (
    <AppShell
      brand="GoalNexa"
      navItems={nav}
      currentPath={location.pathname}
      linkComponent={ShellLink}
      user={session?.user ?? null}
      onLogout={session ? () => void logout() : undefined}
      userMenu={userMenu.items}
      onUserMenuOpen={userMenu.refresh}
    >
      {session?.user.impersonated_by && (
        <div className="alert alert-warning d-flex align-items-center gap-3 mb-3" role="status">
          <div>{t.rich("viewingAs", { name: session.user.name, email: session.user.email })}</div>
          <button type="button" className="btn btn-sm btn-warning ms-auto" onClick={endImpersonation}>
            {t("stopViewing")}
          </button>
        </div>
      )}
      <AnnouncementBanner accessToken={accessToken} />
      <Outlet context={accessToken} />
    </AppShell>
  );
}
