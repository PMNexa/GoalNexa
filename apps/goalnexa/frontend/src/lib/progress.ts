import type { Goal, GoalHealth } from "./api/goals";
import type { Metric } from "./api/metrics";
import type { CheckIn, CheckInSource } from "./api/checkIns";
import { periodStart } from "./periods";

/**
 * A goal's progress = the mean of its ROOT metrics' progress (see
 * `rootMetrics` - sub-metrics break a root down, they don't count), each metric's
 * being how far its value has moved from `base_value` toward
 * `target_value`, as a percentage: `(value - base) / (target - base)`
 * (can exceed 100; never below 0). The same formula covers a metric that
 * should go DOWN (base 80, target 70). Metrics whose target equals their
 * base are skipped - there's no distance to measure (`isTracked`). A goal with no
 * usable metrics has no progress at all (`current: null`, empty series),
 * not 0%.
 *
 * A metric's value over time replays its check-ins: each one IS the new
 * value, or - for a `sum` metric - adds to a running total that starts
 * at `base_value`. The backend's `goalnexa/progress.py` implements the
 * same rules (it stores each goal's progress/health) - keep them in step.
 */
export interface ProgressPoint {
  /** Epoch ms of the check-in that produced this point. */
  t: number;
  pct: number;
  /** The raw reading behind `pct`, when the point is one metric's own check-in (see `computeMetricSeries`). */
  value?: number;
  /** Where that check-in came from (see `computeMetricSeries`). */
  source?: CheckInSource;
}

export interface GoalProgress {
  goal: Goal;
  metricCount: number;
  current: number | null;
  /** One point per check-in on any of the goal's metrics, oldest first. */
  series: ProgressPoint[];
  lastCheckIn: number | null;
}

function isUsable(metric: Metric): boolean {
  return Number(metric.target_value) !== Number(metric.base_value);
}

/**
 * A metric whose target equals its base has no distance to measure, so no
 * %: it's TRACKED only - its readings are charted as values, and it counts
 * toward nothing (progress, projection, health).
 */
export function isTracked(metric: Metric): boolean {
  return !isUsable(metric);
}

export function metricPct(value: string | number, metric: Metric): number {
  const base = Number(metric.base_value);
  if (metric.target_per) {
    // A target per period (backend `goalnexa.periods.pct`): the hit rate, or
    // the total against every period's target added up.
    if (metric.progress_by === "hit_rate") return Number(metric.hit_rate ?? 0);
    const span = Number(metric.cumulative_target ?? metric.target_value) - base;
    return span > 0 ? Math.max(0, ((Number(value) - base) / span) * 100) : 0;
  }
  return Math.max(0, ((Number(value) - base) / (Number(metric.target_value) - base)) * 100);
}

/** Whether `metric` has a target per period counted by how often it's hit. */
export function isHitRate(metric: Metric): boolean {
  return !!metric.target_per && metric.progress_by === "hit_rate";
}

/**
 * Where a target-per-period metric is heading, in % - backend
 * `goalnexa.periods.pace_pct`: its hit rate, or its total against what was
 * expected by now (on pace = 100%). Null without enough to go on.
 */
export function pacePct(metric: Metric): number | null {
  if (isHitRate(metric)) return metric.hit_rate == null ? null : Number(metric.hit_rate);
  if (metric.expected_value == null) return null;
  const expected = Number(metric.expected_value) - Number(metric.base_value);
  if (expected <= 0) return null;
  return Math.max(0, ((Number(metric.current_value) - Number(metric.base_value)) / expected) * 100);
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Replays one metric's check-ins (call it in time order): each call returns
 * the metric's value once that check-in is in - a reading, or a running
 * total for `sum`. With one reading per period (`one_per`), a sum check-in
 * is its period's total so far, so it replaces the period's earlier one.
 */
function replayer(metric: Metric): (checkIn: CheckIn) => number {
  const base = Number(metric.base_value);
  if (metric.aggregation !== "sum") return (checkIn) => Number(checkIn.value);
  const per = metric.one_per;
  if (per) {
    const byPeriod = new Map<number, number>();
    return (checkIn) => {
      byPeriod.set(periodStart(Date.parse(checkIn.checked_in_at), per), Number(checkIn.value));
      let total = base;
      for (const value of byPeriod.values()) total += value;
      return total;
    };
  }
  let total = base;
  return (checkIn) => (total += Number(checkIn.value));
}

/**
 * The metrics a goal's progress counts: those with no parent, or whose
 * parent isn't one of the same goal's metrics (the same roots the goal
 * tree shows). Pass ALL metrics - filter out hidden ones afterwards, or a
 * hidden root's sub-metrics would be promoted to roots.
 */
export function rootMetrics(metrics: Metric[]): Metric[] {
  const goalById = new Map(metrics.map((m) => [m.id, m.goal]));
  return metrics.filter((m) => m.parent === null || m.parent === m.id || goalById.get(m.parent) !== m.goal);
}

/** `metrics` = the ones to average (callers pass `rootMetrics(...)`, minus any hidden). */
export function computeGoalProgress(goals: Goal[], metrics: Metric[], checkIns: CheckIn[]): GoalProgress[] {
  const metricById = new Map(metrics.map((m) => [m.id, m]));
  const sortedCheckIns = [...checkIns].sort((a, b) => Date.parse(a.checked_in_at) - Date.parse(b.checked_in_at));

  return goals.map((goal) => {
    const own = metrics.filter((m) => m.goal === goal.id);
    const usable = own.filter(isUsable);
    if (usable.length === 0) {
      return { goal, metricCount: own.length, current: null, series: [], lastCheckIn: null };
    }

    // Replay check-ins in time order. Before its first check-in a metric
    // reads its base - where `Metric.current_value` starts too.
    const values = new Map(usable.map((m) => [m.id, Number(m.base_value)]));
    const replays = new Map(usable.map((m) => [m.id, replayer(m)]));
    const series: ProgressPoint[] = [];
    for (const checkIn of sortedCheckIns) {
      const metric = metricById.get(checkIn.metric);
      if (!metric || metric.goal !== goal.id || !values.has(metric.id)) continue;
      values.set(metric.id, (replays.get(metric.id) as (c: CheckIn) => number)(checkIn));
      series.push({
        t: Date.parse(checkIn.checked_in_at),
        pct: mean(usable.map((m) => metricPct(values.get(m.id) ?? Number(m.base_value), m))),
      });
    }

    return {
      goal,
      metricCount: own.length,
      current: mean(usable.map((m) => metricPct(m.current_value, m))),
      series,
      lastCheckIn: series.length > 0 ? series[series.length - 1].t : null,
    };
  });
}

/**
 * One metric's own progress over time: its progress from base toward
 * target (see the top of this file) at each of its check-ins, oldest
 * first - `value` is the metric's value then (a running total for `sum`). Empty for a metric whose target equals its base.
 */
export function computeMetricSeries(metric: Metric, checkIns: CheckIn[]): ProgressPoint[] {
  if (!isUsable(metric)) return [];
  return computeValueSeries(metric, checkIns).map((point) => ({ ...point, pct: metricPct(point.value, metric) }));
}

export interface ValuePoint {
  t: number;
  value: number;
  source?: CheckInSource;
}

/** One metric's value at each of its check-ins, oldest first (a running total for `sum`) - any metric, tracked ones too. */
export function computeValueSeries(metric: Metric, checkIns: CheckIn[]): ValuePoint[] {
  const apply = replayer(metric);
  return checkIns
    .filter((checkIn) => checkIn.metric === metric.id)
    .sort((a, b) => Date.parse(a.checked_in_at) - Date.parse(b.checked_in_at))
    .map((checkIn) => {
      return { t: Date.parse(checkIn.checked_in_at), value: apply(checkIn), source: checkIn.source };
    });
}

/** A goal's `target_date` ("YYYY-MM-DD") as local midnight epoch ms, or null. */
export function goalTargetTime(goal: Goal): number | null {
  if (!goal.target_date) return null;
  const [year, month, day] = goal.target_date.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

/**
 * Linear projection of one metric to `targetT`: the least-squares slope
 * (value per ms) over all its check-ins, carried forward from its LATEST
 * reading - so the projection starts where the metric actually is, not
 * where the fitted line happens to cross. Null without a trend to go on
 * (fewer than 2 check-in times) or when `targetT` isn't after the latest
 * check-in.
 */
export function projectMetric(metric: Metric, checkIns: CheckIn[], targetT: number): ProgressPoint | null {
  if (metric.target_per) {
    // By pace, not trend - the quota says exactly where it should be.
    const pct = pacePct(metric);
    return pct === null ? null : { t: targetT, pct };
  }
  const series = computeMetricSeries(metric, checkIns);
  if (series.length < 2) return null;
  const last = series[series.length - 1];
  if (targetT <= last.t) return null;

  const meanT = mean(series.map((p) => p.t));
  const meanV = mean(series.map((p) => p.value as number));
  let num = 0;
  let den = 0;
  for (const p of series) {
    num += (p.t - meanT) * ((p.value as number) - meanV);
    den += (p.t - meanT) ** 2;
  }
  if (den === 0) return null; // every check-in at the same moment

  const value = (last.value as number) + (num / den) * (targetT - last.t);
  return { t: targetT, pct: metricPct(value, metric), value };
}

/**
 * A goal's projected progress at `targetT`: the mean over its usable
 * metrics among `metrics` (the same set `computeGoalProgress` averages) of each one's
 * projection, a metric with no trend held at its current progress. Null
 * when no metric has a projection at all.
 */
export function projectGoal(goal: Goal, metrics: Metric[], checkIns: CheckIn[], targetT: number): number | null {
  const usable = metrics.filter((m) => m.goal === goal.id && isUsable(m));
  const projected = usable.map((m) => projectMetric(m, checkIns, targetT));
  if (projected.every((p) => p === null)) return null;
  return mean(usable.map((m, i) => projected[i]?.pct ?? metricPct(m.current_value, m)));
}

/** Projected % at or above this (under 100) is at risk; below, off track. Same as the backend's `AT_RISK_FLOOR`. */
export const AT_RISK_FLOOR = 80;

/**
 * Where a goal is heading - the backend's `goal_health`, over the
 * dashboard's own numbers (so it matches the % and projection shown next
 * to it, hidden metrics left out): achieved at 100%+; otherwise, with a
 * target date, off track once it's passed, else from the projection.
 */
export function goalHealth(
  current: number | null,
  projected: number | null,
  targetT: number | null,
  now: number,
  { canAchieve = true }: { canAchieve?: boolean } = {},
): GoalHealth {
  if (current === null) return "unknown";
  // A hit rate is at 100% from its first period hit - done only once the goal ends.
  if (current >= 100 && canAchieve) return "achieved";
  if (targetT === null) return "unknown";
  // The target is the START of its day - past it once that day is over.
  if (now >= targetT + 24 * 60 * 60 * 1000) return "off_track";
  if (projected === null) return "unknown";
  if (projected >= 100) return "on_track";
  return projected >= AT_RISK_FLOOR ? "at_risk" : "off_track";
}

/** Whether the metric's scheduled check-in is due (server-kept `check_in_due_at`). */
export function isCheckInDue(metric: Metric, now: number): boolean {
  return metric.check_in_due_at !== null && Date.parse(metric.check_in_due_at) <= now;
}
