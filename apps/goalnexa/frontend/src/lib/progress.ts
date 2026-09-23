import type { Goal } from "./api/goals";
import type { Metric } from "./api/metrics";
import type { CheckIn } from "./api/checkIns";

/**
 * A goal's progress = the mean of its ROOT metrics' progress (see
 * `rootMetrics` - sub-metrics break a root down, they don't count), each metric's
 * being how far its value has moved from `base_value` toward
 * `target_value`, as a percentage: `(value - base) / (target - base)`
 * (can exceed 100; never below 0). The same formula covers a metric that
 * should go DOWN (base 80, target 70). Metrics whose target equals their
 * base are skipped - there's no distance to measure. A goal with no
 * usable metrics has no progress at all (`current: null`, empty series),
 * not 0%.
 */
export interface ProgressPoint {
  /** Epoch ms of the check-in that produced this point. */
  t: number;
  pct: number;
  /** The raw reading behind `pct`, when the point is one metric's own check-in (see `computeMetricSeries`). */
  value?: number;
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

function metricPct(value: string | number, metric: Metric): number {
  const base = Number(metric.base_value);
  return Math.max(0, ((Number(value) - base) / (Number(metric.target_value) - base)) * 100);
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
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
    const series: ProgressPoint[] = [];
    for (const checkIn of sortedCheckIns) {
      const metric = metricById.get(checkIn.metric);
      if (!metric || metric.goal !== goal.id || !values.has(metric.id)) continue;
      values.set(metric.id, Number(checkIn.value));
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
 * first. Empty for a metric whose target equals its base.
 */
export function computeMetricSeries(metric: Metric, checkIns: CheckIn[]): ProgressPoint[] {
  if (!isUsable(metric)) return [];
  return checkIns
    .filter((checkIn) => checkIn.metric === metric.id)
    .map((checkIn) => ({
      t: Date.parse(checkIn.checked_in_at),
      pct: metricPct(checkIn.value, metric),
      value: Number(checkIn.value),
    }))
    .sort((a, b) => a.t - b.t);
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
