import { useCallback, useContext } from "react";
import { Link as RouterLink, UNSAFE_FrameworkContext, useOutletContext } from "react-router";
import { useResourcePath, type LinkComponentProps } from "platform-core";
import { SHARED_DASHBOARD_ROUTE_ID } from "../dashboardRoutes";
import DashboardScreen from "../screens/DashboardScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Dashboard" }];
}

/** The details drawer's links (Edit, related rows) are relative mount paths - same as platform-core's `crud-detail.tsx`. */
function DashboardLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

interface ManifestRoute {
  parentId?: string;
  path?: string;
}

/**
 * A public link's full URL, from where the host mounted
 * `createSharedDashboardRoutes` (read from the route manifest, like
 * platform-core's `useResourcePath`). `undefined` when it didn't - no "Share".
 */
function useShareUrl(): ((token: string) => string) | undefined {
  const routes = useContext(UNSAFE_FrameworkContext)?.manifest.routes as Record<string, ManifestRoute | undefined> | undefined;
  let route = routes?.[SHARED_DASHBOARD_ROUTE_ID];
  const segments: string[] = [];
  while (route) {
    if (route.path) segments.unshift(route.path.replace(/^\/+|\/+$/g, ""));
    route = route.parentId ? routes?.[route.parentId] : undefined;
  }
  const pattern = segments.join("/");
  const shareUrl = useCallback(
    (token: string) => new URL(`/${pattern.replace(":token", encodeURIComponent(token))}`, window.location.origin).href,
    [pattern],
  );
  return pattern ? shareUrl : undefined;
}

/**
 * Registered by `createDashboardRoutes()` (see `../dashboardRoutes.ts`).
 * Mounted inside the host's app-shell layout, which gates on a session
 * and hands the access token down via `<Outlet context={accessToken}>` -
 * same shape as platform-core's `crud-*.tsx`.
 */
export default function DashboardRoute() {
  const accessToken = useOutletContext<string>();
  const resourcePath = useResourcePath();
  const shareUrl = useShareUrl();
  return (
    <DashboardScreen
      accessToken={accessToken}
      linkComponent={DashboardLink}
      resourcePath={resourcePath}
      shareUrl={shareUrl}
    />
  );
}
