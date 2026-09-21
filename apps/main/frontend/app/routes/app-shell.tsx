import { useEffect, useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router";
import { AppShell } from "platform-ui-frontend";
import type { LinkComponentProps } from "platform-ui-frontend";
import { ORGS_PATH } from "platform-org-frontend";
import { clearSession, getSession, subscribeSession } from "../lib/session";

function ShellLink({ to, className, children }: LinkComponentProps) {
  return (
    <RouterLink to={to} className={className}>
      {children}
    </RouterLink>
  );
}

const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Organizations", to: `/${ORGS_PATH}` },
];

/**
 * Wraps every screen except login/signup (see routes.ts) with platform-ui-
 * frontend's AppShell (sidemenu + sticky header). Owns the pieces AppShell
 * deliberately doesn't: the router Link, the nav item list (spans multiple
 * modules' routes, so it can't live in any one module's package), and the
 * session read.
 *
 * "Log out" only clears main's own local session singleton - there's no
 * backend /logout endpoint yet (platform-auth's own AGENTS.md notes this
 * is deliberately out of scope so far), so the httpOnly refresh cookie is
 * still valid. A full page reload after clicking it will silently log the
 * user back in via root.tsx's boot refresh. Fine for now; revisit once a
 * real logout endpoint exists (should revoke the refresh token server-side
 * before clearing the local session).
 */
export default function AppShellLayout() {
  const location = useLocation();
  const [session, setSessionState] = useState(() => getSession());

  useEffect(() => {
    return subscribeSession(() => setSessionState(getSession()));
  }, []);

  return (
    <AppShell
      navItems={NAV_ITEMS}
      currentPath={location.pathname}
      linkComponent={ShellLink}
      user={session?.user ?? null}
      onLogout={session ? () => clearSession() : undefined}
    >
      <Outlet />
    </AppShell>
  );
}
