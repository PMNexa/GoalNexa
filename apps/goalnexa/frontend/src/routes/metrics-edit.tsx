import { useNavigate, useOutletContext } from "react-router";
import { METRICS_PATHS } from "../lib/metricsPaths";
import MetricsEditScreen from "../screens/MetricsEditScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Edit metric" }];
}

/** Same reason/shape as `goals-edit.tsx` - `MetricsEditScreen` adds this metric's own `MetricCheckInsSection` on top of `CrudEditScreen`. */
export default function MetricsEditRoute({ params }: { params: { id: string } }) {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  const goToList = () => navigate(`/${METRICS_PATHS.listPath}`);

  return <MetricsEditScreen accessToken={accessToken} id={params.id} onUpdated={goToList} onDeleted={goToList} />;
}
