import { Link as RouterLink, useOutletContext } from "react-router";
import { useResourcePath, type LinkComponentProps } from "platform-core";
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

/**
 * Registered by `createDashboardRoutes()` (see `../dashboardRoutes.ts`).
 * Mounted inside the host's app-shell layout, which gates on a session
 * and hands the access token down via `<Outlet context={accessToken}>` -
 * same shape as platform-core's `crud-*.tsx`.
 */
export default function DashboardRoute() {
  const accessToken = useOutletContext<string>();
  const resourcePath = useResourcePath();
  return <DashboardScreen accessToken={accessToken} linkComponent={DashboardLink} resourcePath={resourcePath} />;
}
