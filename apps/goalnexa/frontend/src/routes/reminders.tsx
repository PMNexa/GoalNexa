import { useOutletContext } from "react-router";
import RemindersScreen from "../screens/RemindersScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Reminders" }];
}

/** Registered by `createRemindersRoutes()`; the token comes from the host's app-shell layout, like `dashboard.tsx`. */
export default function RemindersRoute() {
  const accessToken = useOutletContext<string>();
  return <RemindersScreen accessToken={accessToken} />;
}
