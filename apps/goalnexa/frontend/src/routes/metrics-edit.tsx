import { useNavigate, useOutletContext } from "react-router";
import { METRICS_PATHS } from "../lib/metricsPaths";
import MetricsEditScreen from "../screens/MetricsEditScreen";

/** See `routes/goals.tsx`'s own docstring for why this file exists here rather than in `apps/main`. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Edit metric" }];
}

/** `params` arrives as an ordinary prop regardless of where this file lives - see `routes/goals-edit.tsx`'s own docstring for why. */
export default function MetricsEditRoute({ params }: { params: { id: string } }) {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  const goToList = () => navigate(`/${METRICS_PATHS.listPath}`);

  return <MetricsEditScreen accessToken={accessToken} id={params.id} onUpdated={goToList} onDeleted={goToList} />;
}
