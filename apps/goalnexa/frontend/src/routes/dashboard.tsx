import { useOutletContext } from "react-router";
import DashboardScreen from "../screens/DashboardScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Dashboard" }];
}

/**
 * Registered by `createDashboardRoutes()` (see `../dashboardRoutes.ts`).
 * Mounted inside the host's app-shell layout, which gates on a session
 * and hands the access token down via `<Outlet context={accessToken}>` -
 * same shape as platform-core's `crud-*.tsx` and this package's own
 * `goals-edit.tsx`.
 */
export default function DashboardRoute() {
  const accessToken = useOutletContext<string>();
  return <DashboardScreen accessToken={accessToken} />;
}
