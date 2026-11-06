import { useParams } from "react-router";
import { localeFromMatches, translator } from "platform-core";
import messages from "../messages";
import SharedDashboardScreen from "../SharedDashboardScreen";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  // A link is meant for the people it's sent to, not for search engines.
  return [{ title: translator(messages, localeFromMatches(matches))("sharedPageTitle") }, { name: "robots", content: "noindex, nofollow" }];
}

/**
 * Registered by `createSharedDashboardRoutes()` (see `../routes.ts`),
 * OUTSIDE the host's app shell: whoever opens a public link isn't signed in.
 */
export default function SharedDashboardRoute() {
  const { token = "" } = useParams();
  return <SharedDashboardScreen key={token} token={token} />;
}
