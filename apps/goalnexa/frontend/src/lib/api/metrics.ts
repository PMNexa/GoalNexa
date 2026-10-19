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
  /** Order among its siblings, lowest first (`lib/ordering.ts`). */
  position: number;
  aggregation: MetricAggregation;
  check_in_every: CheckInCadence;
  /** Server-kept (ISO timestamps): the latest check-in's time, and when the next one is due (`null` = no schedule). */
  last_checked_in_at: string | null;
  check_in_due_at: string | null;
  /** The end of the metric's ingest token; "" = none. */
  ingest_token_hint: string;
  /** A target per period (docs/period-targets.md): "" = the whole goal; else `target_value` is the quota per period. */
  target_per?: TargetPer;
  count_days?: "all" | "weekdays";
  progress_by?: "total" | "hit_rate";
  /** One reading per period: only the last check-in of each period counts ("" = every one) - a sum check-in is then the period's total so far. */
  one_per?: TargetPer;
  /** Check-ins are for a period ("" = any time, "goal" = inherited - its goal's, or a sub-metric's parent metric's): the server sets each check-in's time to its period's moment (below; the first day, 00:00 by default). */
  snap_to?: TargetPer | "goal";
  /** The moment in the period (P-67): a week's weekday (1 = Monday), a quarter's month (1-3), a year's month (1-12), the day of the month (past its end = the last day), the time ("HH:MM"). */
  snap_weekday?: number;
  snap_quarter_month?: number;
  snap_month?: number;
  snap_day?: number;
  snap_time?: string;
  /** The period's check-in is due at that moment (`check_in_due_at`). */
  snap_due?: boolean;
  /** The period check-ins are for, after "goal" ("" = any time) - what to read, not `snap_to`. */
  snap_period?: TargetPer;
  /** Server-kept for a target per period (decimal strings): this period's amount, every period's target added up, where the total should be by now, % of periods hit, hits in a row. */
  period_value?: string | null;
  cumulative_target?: string | null;
  expected_value?: string | null;
  hit_rate?: string | null;
  streak?: number | null;
  /** What's left - see `Pace`. */
  pace?: Pace | null;
}

export type TargetPer = "" | "day" | "week" | "month" | "quarter" | "year";

/**
 * The server's "what's left" (`goalnexa.periods.pace_hint`): for a target
 * per period, this period's amount, quota and what's left of it; for a
 * running total with a target date, what's needed per day (and week).
 */
export interface Pace {
  per: TargetPer;
  in_period?: boolean;
  period_label?: string;
  done?: number;
  quota?: number;
  left?: number;
  days_left?: number;
  per_day?: number;
  per_week?: number;
}
