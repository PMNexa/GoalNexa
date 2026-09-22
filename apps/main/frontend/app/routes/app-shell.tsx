import { useEffect, useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router";
import { AppShell } from "platform-core";
import type { LinkComponentProps } from "platform-core";
import { ORGS_PATH } from "platform-org-frontend";
import { clearSession, getSession, subscribeSession } from "../lib/session";
import { useRequireAccessToken } from "../lib/useRequireAccessToken";

function ShellLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={to} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Organizations", to: `/${ORGS_PATH}` },
];

/**
 * Wraps every screen except login/signup (see routes.ts) with platform-
 * core's AppShell (sidemenu + sticky header). Owns the pieces AppShell
 * deliberately doesn't: the router Link, the nav item list (spans multiple
 * modules' routes, so it can't live in any one module's package), and the
 * session read.
 *
 * Also the ONE place every route nested under this layout gets gated on
 * having a session (`useRequireAccessToken` redirects to login once
 * that's definitely absent) - previously each protected screen's own
 * route file did this individually; now that platform-org-frontend's own
 * route modules live outside apps/main (see routes.ts), they have no
 * session-reading logic of their own to duplicate this in, so it moved up
 * to the one layout that actually needs it. The gated token is handed
 * down via `<Outlet context={accessToken}>` - `routes/orgs.tsx` (etc.)
 * read it with `useOutletContext<string>()`.
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
  const accessToken = useRequireAccessToken();

  useEffect(() => {
    return subscribeSession(() => setSessionState(getSession()));
  }, []);

  if (accessToken === null) return null;

  return (
    <AppShell
      navItems={NAV_ITEMS}
      currentPath={location.pathname}
      linkComponent={ShellLink}
      user={session?.user ?? null}
      onLogout={session ? () => clearSession() : undefined}
    >
      <Outlet context={accessToken} />
    </AppShell>
  );
}
