import { useParams } from "react-router";
import SharedDashboardScreen from "../screens/SharedDashboardScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  // A link is meant for the people it's sent to, not for search engines.
  return [{ title: "Shared goals" }, { name: "robots", content: "noindex, nofollow" }];
}

/**
 * Registered by `createSharedDashboardRoutes()` (see `../dashboardRoutes.ts`),
 * OUTSIDE the host's app shell: whoever opens a public link isn't signed in.
 */
export default function SharedDashboardRoute() {
  const { token = "" } = useParams();
  return <SharedDashboardScreen key={token} token={token} />;
}
