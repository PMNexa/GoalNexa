/** What a check-in's value is: the metric's new reading, or an amount added to its total. */
export type MetricAggregation = "latest" | "sum";

/** How often a check-in is expected; "" = no schedule. */
export type CheckInCadence = "" | "daily" | "weekly" | "monthly";

export interface Metric {
  id: string;
  goal: string;
  name: string;
  description: string;
  unit: string;
  /** DRF `DecimalField` serializes as a string, not a JSON number - avoids float precision loss over the wire. */
  /** Where the metric started - progress is measured from here toward `target_value`. */
  base_value: string;
  target_value: string;
  current_value: string;
  /** A sub-metric's parent - a bare id, `null` for a top-level metric. */
  parent: string | null;
  aggregation: MetricAggregation;
  check_in_every: CheckInCadence;
  /** Server-kept (ISO timestamps): the latest check-in's time, and when the next one is due (`null` = no schedule). */
  last_checked_in_at: string | null;
  check_in_due_at: string | null;
  /** The end of the metric's ingest token; "" = none. */
  ingest_token_hint: string;
}
