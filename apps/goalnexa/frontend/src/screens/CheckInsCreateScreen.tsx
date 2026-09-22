import { CrudCreateScreen } from "platform-core";
import { createCheckInsCrudConfig } from "../lib/checkInsCrudConfig";
import { useMetricOptions } from "../lib/useMetricOptions";
import type { CheckIn } from "../lib/api/checkIns";

export interface CheckInsCreateScreenProps {
  accessToken: string;
  onCreated?: (checkIn: CheckIn) => void;
}

/**
 * The create screen - `platform-core`'s `CrudCreateScreen` preconfigured
 * for `CheckIn`. Gated on `useMetricOptions` (unlike `CheckInsScreen`) -
 * the required `metric` select field is meaningless with zero options,
 * same reasoning `MetricsCreateScreen` uses for its own `goal` field.
 */
function CheckInsCreateScreen({ accessToken, onCreated }: CheckInsCreateScreenProps) {
  const { metricOptions, error } = useMetricOptions(accessToken);

  if (error)
    return (
      <p className="text-danger" role="alert">
        {error.message}
      </p>
    );
  if (!metricOptions) return <p className="text-secondary">Loading…</p>;
  if (metricOptions.length === 0) return <p className="text-secondary">Create a metric first - a check-in always belongs to one.</p>;

  return <CrudCreateScreen config={createCheckInsCrudConfig(accessToken, metricOptions)} onCreated={onCreated} />;
}

export default CheckInsCreateScreen;
