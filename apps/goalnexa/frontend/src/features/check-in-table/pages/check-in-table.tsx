import { useOutletContext } from "react-router";
import { localeFromMatches, translator } from "platform-core";
import messages from "../messages";
import CheckInTableScreen from "../CheckInTableScreen";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(messages, localeFromMatches(matches))("pageTitle") }];
}

/** Registered by `createCheckInTableRoutes()`; the token comes from the host's app-shell layout, like `dashboard.tsx`. */
export default function CheckInTableRoute() {
  const accessToken = useOutletContext<string>();
  return <CheckInTableScreen accessToken={accessToken} />;
}
