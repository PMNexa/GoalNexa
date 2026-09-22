import { CrudListScreen } from "platform-core";
import type { LinkComponent } from "platform-core";
import { createCheckInsCrudConfig } from "../lib/checkInsCrudConfig";
import { useMetricOptions } from "../lib/useMetricOptions";
import type { CheckIn } from "../lib/api/checkIns";

export interface CheckInsScreenProps {
  accessToken: string;
  linkComponent?: LinkComponent;
  onDeleted?: (checkIn: CheckIn) => void;
}

/** The list screen - `platform-core`'s `CrudListScreen` preconfigured for `CheckIn`. Same non-blocking `useMetricOptions` use as `MetricsScreen`'s own `useGoalOptions` - see its docstring. */
function CheckInsScreen({ accessToken, linkComponent, onDeleted }: CheckInsScreenProps) {
  const { metricOptions } = useMetricOptions(accessToken);
  return (
    <CrudListScreen config={createCheckInsCrudConfig(accessToken, metricOptions ?? [], linkComponent)} onDeleted={onDeleted} />
  );
}

export default CheckInsScreen;
