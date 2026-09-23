import type { Goal } from "./api/goals";
import type { Metric } from "./api/metrics";
import type { CheckIn } from "./api/checkIns";

/**
 * A goal's progress = the mean of its metrics' progress, each metric's
 * being `value / target_value` as a percentage (can exceed 100). Metrics
 * with no positive target are skipped - there's nothing to be a
 * percentage OF. A goal with no usable metrics has no progress at all
 * (`current: null`, empty series), not 0%.
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

function metricPct(value: string | number, target: string | number): number {
  return Math.max(0, (Number(value) / Number(target)) * 100);
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

export function computeGoalProgress(goals: Goal[], metrics: Metric[], checkIns: CheckIn[]): GoalProgress[] {
  const metricById = new Map(metrics.map((m) => [m.id, m]));
  const sortedCheckIns = [...checkIns].sort((a, b) => Date.parse(a.checked_in_at) - Date.parse(b.checked_in_at));

  return goals.map((goal) => {
    const own = metrics.filter((m) => m.goal === goal.id);
    const usable = own.filter((m) => Number(m.target_value) > 0);
    if (usable.length === 0) {
      return { goal, metricCount: own.length, current: null, series: [], lastCheckIn: null };
    }

    // Replay check-ins in time order. Before its first check-in a metric
    // reads 0 - the same default `Metric.current_value` starts at.
    const values = new Map(usable.map((m) => [m.id, 0]));
    const series: ProgressPoint[] = [];
    for (const checkIn of sortedCheckIns) {
      const metric = metricById.get(checkIn.metric);
      if (!metric || metric.goal !== goal.id || !values.has(metric.id)) continue;
      values.set(metric.id, Number(checkIn.value));
      series.push({
        t: Date.parse(checkIn.checked_in_at),
        pct: mean(usable.map((m) => metricPct(values.get(m.id) ?? 0, m.target_value))),
      });
    }

    return {
      goal,
      metricCount: own.length,
      current: mean(usable.map((m) => metricPct(m.current_value, m.target_value))),
      series,
      lastCheckIn: series.length > 0 ? series[series.length - 1].t : null,
    };
  });
}

/**
 * One metric's own progress over time: `value / target_value` as a
 * percentage at each of its check-ins, oldest first. Empty for a metric
 * with no positive target.
 */
export function computeMetricSeries(metric: Metric, checkIns: CheckIn[]): ProgressPoint[] {
  if (!(Number(metric.target_value) > 0)) return [];
  return checkIns
    .filter((checkIn) => checkIn.metric === metric.id)
    .map((checkIn) => ({
      t: Date.parse(checkIn.checked_in_at),
      pct: metricPct(checkIn.value, metric.target_value),
      value: Number(checkIn.value),
    }))
    .sort((a, b) => a.t - b.t);
}
