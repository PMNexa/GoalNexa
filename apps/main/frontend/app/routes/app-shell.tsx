import { useEffect, useState } from "react";
import { Link as RouterLink, Outlet, useLocation } from "react-router";
import { AppShell } from "platform-core";
import type { LinkComponentProps } from "platform-core";
import { clearSession, getSession, subscribeSession } from "../lib/session";
import { useRequireAccessToken } from "../lib/useRequireAccessToken";

function ShellLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={to} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

// Plain literals, not computed path constants imported from
// goalnexa-frontend/platform-org-frontend (neither exports any anymore)
// - this app owns every actual URL for every module it wires up, and a
// link that never changes gains nothing from a shared constant over a
// literal at its one use site. See root AGENTS.md's routing section.
const NAV_ITEMS = [
  { label: "Home", to: "/" },
  { label: "Goals", to: "/goals" },
  { label: "Metrics", to: "/metrics" },
  { label: "Check-ins", to: "/check-ins" },
  { label: "Organizations", to: "/platform-org/orgs" },
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
 * that's definitely absent) - every generic CRUD resource's own route
 * files live in `platform-core` now (see `routes.ts`), so they have no
 * session-reading logic of their own to duplicate this in, so it moved
 * up to the one layout that actually needs it. The gated token is
 * handed down via `<Outlet context={accessToken}>` - `platform-core`'s
 * `crud-list.tsx`/`crud-new.tsx`/`crud-edit.tsx` (and goalnexa-frontend's
 * own `goals-edit.tsx`/`metrics-edit.tsx`) read it with
 * `useOutletContext<string>()`.
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
