export interface Metric {
  id: string;
  goal: string;
  name: string;
  unit: string;
  /** DRF `DecimalField` serializes as a string, not a JSON number - avoids float precision loss over the wire. */
  /** Where the metric started - progress is measured from here toward `target_value`. */
  base_value: string;
  target_value: string;
  current_value: string;
  /** A sub-metric's parent - a bare id, `null` for a top-level metric. */
  parent: string | null;
}
