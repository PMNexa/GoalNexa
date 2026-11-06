import { localeFromMatches, translator } from "platform-core";
import { useOutletContext } from "react-router";
import RemindersScreen from "../RemindersScreen";
import messages from "./messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(messages, localeFromMatches(matches))("pageTitle") }];
}

/** Registered by `createRemindersRoutes()`; the token comes from the host's app-shell layout, like `dashboard.tsx`. */
export default function RemindersRoute() {
  const accessToken = useOutletContext<string>();
  return <RemindersScreen accessToken={accessToken} />;
}
