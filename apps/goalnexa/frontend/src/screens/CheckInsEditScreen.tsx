import { CrudEditScreen } from "platform-core";
import { createCheckInsCrudConfig } from "../lib/checkInsCrudConfig";
import { useMetricOptions } from "../lib/useMetricOptions";
import type { CheckIn } from "../lib/api/checkIns";

export interface CheckInsEditScreenProps {
  accessToken: string;
  id: string;
  onUpdated?: (checkIn: CheckIn) => void;
  onDeleted?: () => void;
}

/** The edit screen - `platform-core`'s `CrudEditScreen` preconfigured for `CheckIn`. Same `useMetricOptions` gate as `CheckInsCreateScreen` (see its own docstring); editing does NOT reassign `Metric.current_value` - see `CheckInViewSet.perform_update`'s own docstring. */
function CheckInsEditScreen({ accessToken, id, onUpdated, onDeleted }: CheckInsEditScreenProps) {
  const { metricOptions, error } = useMetricOptions(accessToken);

  if (error)
    return (
      <p className="text-danger" role="alert">
        {error.message}
      </p>
    );
  if (!metricOptions) return <p className="text-secondary">Loading…</p>;

  return (
    <CrudEditScreen
      config={createCheckInsCrudConfig(accessToken, metricOptions)}
      id={id}
      onUpdated={onUpdated}
      onDeleted={onDeleted}
    />
  );
}

export default CheckInsEditScreen;
