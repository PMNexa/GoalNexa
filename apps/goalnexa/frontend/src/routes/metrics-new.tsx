import { useNavigate, useOutletContext } from "react-router";
import { METRICS_PATHS } from "../lib/metricsPaths";
import MetricsCreateScreen from "../screens/MetricsCreateScreen";

/** See `routes/goals.tsx`'s own docstring for why this file exists here rather than in `apps/main`. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "New metric" }];
}

export default function MetricsNewRoute() {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  return <MetricsCreateScreen accessToken={accessToken} onCreated={() => navigate(`/${METRICS_PATHS.listPath}`)} />;
}
