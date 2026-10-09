import { useOutletContext } from "react-router";
import CheckInTableScreen from "../screens/CheckInTableScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Check-in table" }];
}

/** Registered by `createCheckInTableRoutes()`; the token comes from the host's app-shell layout, like `dashboard.tsx`. */
export default function CheckInTableRoute() {
  const accessToken = useOutletContext<string>();
  return <CheckInTableScreen accessToken={accessToken} />;
}
