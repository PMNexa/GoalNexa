import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AppShell, defineMessages, useT } from "platform-core";
import type { NavEntry, UserMenuEntry } from "platform-core";
import { getSession, logout, subscribeSession, useMyPermissions } from "platform-auth-frontend";
import { BackIcon } from "../lib/navIcons";
import { ShellLink } from "../lib/ShellLink";
import { allowedConsoleNav } from "../lib/systemNav";
import { useRequireAccessToken } from "../lib/useRequireAccessToken";

const messages = defineMessages({
  en: { back: "Back to GoalNexa", account: "My account", brand: "System console" },
  vi: { back: "Quay lại GoalNexa", account: "Tài khoản của tôi", brand: "Bảng quản trị hệ thống" },
});

/**
 * The system console: every instance-wide admin page (status, settings,
 * users and roles, all organizations, logs - plus a downstream build's
 * own, e.g. hosted billing) in a shell of its own, so running the
 * instance is kept apart from using it. The app's sidebar has none of
 * these; its user menu links here for admins (`useUserMenu`).
 *
 * Same session gate as app-shell.tsx, then a permission gate: someone
 * with none of the console's permissions is sent to the dashboard. That's
 * only so they don't land on pages that 403 - the API enforces RBAC on
 * every request either way. The token goes down the same way
 * (`<Outlet context={accessToken}>`), so the generic CRUD screens work
 * unchanged under /system.
 */
export default function SystemShellLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const t = useT(messages);
  const [session, setSessionState] = useState(() => getSession());
  const accessToken = useRequireAccessToken();
  const permissions = useMyPermissions();
  const allowed = allowedConsoleNav(permissions);
  const denied = permissions !== null && allowed.length === 0;

  useEffect(() => subscribeSession(() => setSessionState(getSession())), []);

  useEffect(() => {
    if (denied) navigate("/dashboard", { replace: true });
  }, [denied, navigate]);

  if (accessToken === null || permissions === null || denied) return null;

  const navItems: NavEntry[] = [{ label: t("back"), to: "/dashboard", icon: BackIcon }, ...allowed];
  const userMenu: UserMenuEntry[] = [
    { label: t("back"), to: "/dashboard" },
    { label: t("account"), to: "/account" },
  ];

  return (
    <AppShell
      brand={t("brand")}
      navItems={navItems}
      currentPath={location.pathname}
      linkComponent={ShellLink}
      user={session?.user ?? null}
      onLogout={session ? () => void logout() : undefined}
      userMenu={userMenu}
    >
      <Outlet context={accessToken} />
    </AppShell>
  );
}
