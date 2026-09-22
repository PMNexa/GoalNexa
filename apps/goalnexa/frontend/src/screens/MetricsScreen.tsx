import { CrudListScreen } from "platform-core";
import type { LinkComponent } from "platform-core";
import { createMetricsCrudConfig } from "../lib/metricsCrudConfig";
import { useGoalOptions } from "../lib/useGoalOptions";
import { useMetricOptions } from "../lib/useMetricOptions";
import type { Metric } from "../lib/api/metrics";

export interface MetricsScreenProps {
  accessToken: string;
  linkComponent?: LinkComponent;
  onDeleted?: (metric: Metric) => void;
}

/** The list screen - `platform-core`'s `CrudListScreen` preconfigured for `Metric`. Renders straight away with the "Goal"/"Parent" columns showing raw ids until `useGoalOptions`/`useMetricOptions` resolve (then re-render with titles) - no loading gate needed here, unlike the create/edit screens, since a list doesn't need either option list to function. */
function MetricsScreen({ accessToken, linkComponent, onDeleted }: MetricsScreenProps) {
  const { goalOptions } = useGoalOptions(accessToken);
  const { metricOptions } = useMetricOptions(accessToken);
  return (
    <CrudListScreen
      config={createMetricsCrudConfig(accessToken, goalOptions ?? [], metricOptions ?? [], linkComponent)}
      onDeleted={onDeleted}
    />
  );
}

export default MetricsScreen;
