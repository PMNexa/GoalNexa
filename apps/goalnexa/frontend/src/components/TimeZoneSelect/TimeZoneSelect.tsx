import { useMemo } from "react";
import { browserTimeZone, timeZones, zoneOffset } from "../../lib/timeZone";

export interface TimeZoneSelectProps {
  id?: string;
  value: string;
  onChange: (zone: string) => void;
  disabled?: boolean;
  "aria-label"?: string;
}

/** A plain select of every IANA time zone, each with its offset now ("Asia/Ho_Chi_Minh (GMT+07:00)"). */
function TimeZoneSelect({ id, value, onChange, disabled, "aria-label": ariaLabel }: TimeZoneSelectProps) {
  const zones = useMemo(() => timeZones(value, browserTimeZone()), [value]);
  return (
    <select
      id={id}
      className="form-select"
      value={value}
      disabled={disabled}
      aria-label={ariaLabel}
      onChange={(event) => onChange(event.target.value)}
    >
      {zones.map((zone) => {
        const offset = zoneOffset(zone);
        return (
          <option key={zone} value={zone}>
            {offset ? `${zone} (${offset})` : zone}
          </option>
        );
      })}
    </select>
  );
}

export default TimeZoneSelect;
