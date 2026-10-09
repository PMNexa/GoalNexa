import { useMemo } from "react";
import type { CheckIn } from "../../lib/api/checkIns";
import type { Goal } from "../../lib/api/goals";
import type { Metric } from "../../lib/api/metrics";
import {
  computeGoalProgress,
  computeMetricSeries,
  computeValueSeries,
  goalTargetTime,
  isTracked,
  projectGoal,
  projectMetric,
  rootMetrics,
  type ProgressPoint,
} from "../../lib/progress";
import { fitDomain, pctDomainMax, type ChartDomain } from "./chartUtils";
import { byPosition } from "../../lib/ordering";

/** Palette has 8 validated categorical slots - a 9th series would need a generated hue, so selection stops at 8. */
export const MAX_GOALS = 8;

/** A check-in's source, in a chart tooltip ("via AI agent"); web check-ins say nothing. */
const SOURCE_LABELS = { web: "the web app", agent: "AI agent", ingest: "ingest URL" } as const;

function formatAmount(value: string | number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Everything the charts are drawn from, for the shown goals - shared by
 * the dashboard and a public link's page (`SharedDashboardScreen`), so
 * both show the same numbers.
 */
export function useDashboardCharts(
  goals: Goal[] | null,
  selected: Map<string, number>,
  metrics: Metric[],
  checkIns: CheckIn[],
  disabledMetrics: Set<string>,
) {
  // What a goal's % averages: its root metrics (sub-metrics break a root
  // down, they don't count), minus hidden ones.
  const countedMetrics = useMemo(
    () => rootMetrics(metrics).filter((metric) => !disabledMetrics.has(metric.id)),
    [metrics, disabledMetrics],
  );

  const progress = useMemo(() => {
    const selectedGoals = (goals ?? []).filter((goal) => selected.has(goal.id));
    return computeGoalProgress(selectedGoals, countedMetrics, checkIns);
  }, [goals, selected, countedMetrics, checkIns]);

  const metricsByGoal = useMemo(() => {
    const byGoal = new Map<string, Metric[]>();
    for (const metric of [...metrics].sort(byPosition((m) => m.name))) {
      byGoal.set(metric.goal, [...(byGoal.get(metric.goal) ?? []), metric]);
    }
    return byGoal;
  }, [metrics]);

  // A metric's line = its place among its goal's metrics (their manual
  // order, `position`) - stable while other metrics are shown/hidden. All of a goal's metrics
  // share one chart; the palette has 8 validated colors, so the 9th+
  // reuse them with another line style (`seriesDash`) - never a
  // generated color.
  const metricSlot = useMemo(() => {
    const metricSlot = new Map<string, number>();
    for (const goalMetrics of metricsByGoal.values()) {
      goalMetrics.forEach((metric, i) => metricSlot.set(metric.id, i + 1));
    }
    return metricSlot;
  }, [metricsByGoal]);

  // Linear projections to each shown goal's target date (none without
  // one): every metric's, and the goal's over its enabled metrics (like
  // its current %).
  const projections = useMemo(() => {
    const byGoal = new Map<string, ProgressPoint>();
    const byMetric = new Map<string, ProgressPoint>();
    for (const p of progress) {
      const target = goalTargetTime(p.goal);
      if (target === null) continue;
      for (const metric of metricsByGoal.get(p.goal.id) ?? []) {
        const projection = projectMetric(metric, checkIns, target);
        if (projection) byMetric.set(metric.id, projection);
      }
      const pct = projectGoal(p.goal, countedMetrics, checkIns, target);
      if (pct !== null) byGoal.set(p.goal.id, { t: target, pct });
    }
    return { byGoal, byMetric };
  }, [progress, countedMetrics, metricsByGoal, checkIns]);

  // Small multiples: one progress-over-time panel per shown goal, one line
  // per shown metric with a target, and a value chart per tracked one.
  const metricPanels = useMemo(
    () =>
      progress.map((p) => {
        const goalMetrics = metricsByGoal.get(p.goal.id) ?? [];
        const shownMetrics = goalMetrics.filter((metric) => !disabledMetrics.has(metric.id));
        const series = shownMetrics.filter((metric) => !isTracked(metric)).map((metric) => ({
          id: metric.id,
          label: metric.name,
          slot: metricSlot.get(metric.id) as number,
          points: computeMetricSeries(metric, checkIns),
          projection: projections.byMetric.get(metric.id) ?? null,
          formatDetail: (point: ProgressPoint) =>
            point.value === undefined
              ? null
              : `${formatAmount(point.value)} / ${formatAmount(metric.target_value)}${metric.unit ? ` ${metric.unit}` : ""}${
                  point.source && point.source !== "web" ? ` · via ${SOURCE_LABELS[point.source]}` : ""
                }`,
        }));
        return {
          progress: p,
          projected: projections.byGoal.get(p.goal.id) ?? null,
          series,
          // Target = base: no %, so charted as values, one small chart each.
          tracked: shownMetrics.filter(isTracked).map((metric) => ({
            id: metric.id,
            label: metric.name,
            unit: metric.unit,
            slot: metricSlot.get(metric.id) as number,
            points: computeValueSeries(metric, checkIns),
          })),
          shownCount: shownMetrics.length,
          // Fits this panel's own lines (min 100%).
          yMax: pctDomainMax(
            series.flatMap((line) => [...line.points, ...(line.projection ? [line.projection] : [])].map((point) => point.pct)),
          ),
        };
      }),
    [progress, projections, metricsByGoal, disabledMetrics, metricSlot, checkIns],
  );

  // Each panel's own time range (goals can run over different periods),
  // stretched to reach now and its goal's target date so the markers show;
  // each also fits its own % ceiling (one goal at 800% would flatten
  // another at 20%). "Now" is re-read whenever the panels change (e.g.
  // after a check-in).
  const { now, panelDomains } = useMemo(() => {
    const now = Date.now();
    const panelDomains = new Map<string, ChartDomain>();
    for (const panel of metricPanels) {
      const target = goalTargetTime(panel.progress.goal);
      const domain = fitDomain(
        [
          ...panel.series.flatMap((line) => line.points),
          // Times only - a tracked metric's values never reach a % axis.
          ...panel.tracked.flatMap((line) => line.points.map((point) => ({ t: point.t, pct: 0 }))),
        ],
        target === null ? [now] : [now, target],
      );
      if (domain) panelDomains.set(panel.progress.goal.id, { ...domain, yMax: panel.yMax });
    }
    return { now, panelDomains };
  }, [metricPanels]);

  return { progress, metricsByGoal, metricSlot, metricPanels, now, panelDomains };
}

export type DashboardChartsData = ReturnType<typeof useDashboardCharts>;
