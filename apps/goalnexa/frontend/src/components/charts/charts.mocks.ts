/**
 * Chart inputs for the chart stories, built the way the dashboard and the
 * team board build them (`useDashboardCharts`, `TeamBoardScreen`) - over
 * the shared fixtures plus a few extra metrics, through the real helpers.
 */
import type { CheckIn } from "../../api/checkIns";
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import type { BoardMetric, CellNumbers, ShownNumbers } from "../../api/teamBoard";
import { periodBars, periodLabel, periodStart, nextPeriodStart, type PeriodBar, type Snap } from "../../lib/periods";
import {
  computeGoalProgress,
  computeMetricSeries,
  computeValueSeries,
  goalTargetTime,
  projectMetric,
  rootMetrics,
  type ProgressPoint,
  type ValuePoint,
} from "../../lib/progress";
import { checkIns, daysAgo, goals, metrics } from "../../storybook/fixtures";
import { fitDomain, type ChartDomain } from "./chartUtils";
import type { ChartMarker, LineSeries } from "./ProgressLineChart";
import type { BarRow } from "./ProgressBarChart";
import type { ChartGoal, ChartPoint, ChartSeries } from "./BoardCharts";

const DAY = 86_400_000;
export const NOW = Date.now();
const markerDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const amount = (v: number | string) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

/** One line per metric with a target, as the dashboard's panel draws it (`withProjection`: to the goal's target date). */
export function lineSeries(goal: Goal, goalMetrics: Metric[], allCheckIns: CheckIn[], withProjection = true): LineSeries[] {
  const target = goalTargetTime(goal);
  return goalMetrics
    .filter((m) => Number(m.target_value) !== Number(m.base_value))
    .map((metric, i) => ({
      id: metric.id,
      label: metric.name,
      slot: i + 1,
      points: computeMetricSeries(metric, allCheckIns),
      projection: withProjection && target !== null ? projectMetric(metric, allCheckIns, target) : null,
      formatDetail: (point: ProgressPoint) =>
        point.value === undefined
          ? null
          : `${amount(point.value)} / ${amount(metric.target_value)}${metric.unit ? ` ${metric.unit}` : ""}${
              point.source === "agent" ? " · via AI agent" : ""
            }`,
    }));
}

/** "Now" and the goal's target date, as the dashboard marks its panels. */
export function goalMarkers(goal: Goal): ChartMarker[] {
  const target = goalTargetTime(goal);
  return [
    { t: NOW, label: "Now", kind: "now" },
    ...(target === null ? [] : [{ t: target, label: `Target ${markerDate.format(target)}`, kind: "target" as const }]),
  ];
}

/** A panel's own time range, stretched to now and its target date (`useDashboardCharts`' `panelDomains`). */
export function panelDomain(goal: Goal, series: LineSeries[], tracked: ValuePoint[][] = []): ChartDomain {
  const target = goalTargetTime(goal);
  const points = [
    ...series.flatMap((s) => [...s.points, ...(s.projection ? [s.projection] : [])]),
    ...tracked.flatMap((line) => line.map((p) => ({ t: p.t, pct: 0 }))),
  ];
  return fitDomain(points, target === null ? [NOW] : [NOW, target]) as ChartDomain;
}

const revenueGoal = goals[0];
const revenueMetrics = metrics.filter((m) => m.goal === revenueGoal.id);

/** "Grow revenue": MRR and paying customers, projected to the target date. */
export const revenueSeries = lineSeries(revenueGoal, revenueMetrics, checkIns);
export const revenueMarkers = goalMarkers(revenueGoal);
export const revenueDomain = panelDomain(revenueGoal, revenueSeries);
export { revenueGoal };

/** A goal with 11 metrics - slots 9-11 reuse the palette with a dotted line. */
export const busyGoal: Goal = { ...goals[1], id: "05000000-0000-7000-8000-0000000000b1", title: "Launch checklist", target_date: null };
const busyMetrics: Metric[] = Array.from({ length: 11 }, (_, i) => ({
  ...metrics[1],
  id: `06000000-0000-7000-8000-0000000000${String(i + 10)}`,
  goal: busyGoal.id,
  name: ["Docs", "Pricing page", "Onboarding", "Billing", "Emails", "Support", "Status page", "Analytics", "Legal", "Press kit", "Beta feedback"][i],
  base_value: "0",
  target_value: "100",
  current_value: String(20 + i * 7),
  unit: "%",
  position: i + 1,
}));
const busyCheckIns: CheckIn[] = busyMetrics.flatMap((m, mi) =>
  Array.from({ length: 6 }, (_, week) => ({
    id: `07000000-0000-7000-8000-00000009${String(mi * 10 + week).padStart(4, "0")}`,
    metric: m.id,
    value: String(Math.round((Number(m.current_value) * (week + 1)) / 6)),
    note: "",
    checked_in_at: daysAgo((5 - week) * 7 + 1 + mi * 0.3),
    author_id: null,
    source: "web" as const,
  })),
);
export const busySeries = lineSeries(busyGoal, busyMetrics, busyCheckIns, false);

/** Over target: a metric past 200% stretches the % axis. */
const overMetric: Metric = { ...metrics[3], id: "06000000-0000-7000-8000-0000000000c1", name: "Sign-ups", target_value: "50", current_value: "130" };
const overCheckIns: CheckIn[] = [20, 55, 90, 130].map((value, i) => ({
  ...checkIns[0],
  id: `07000000-0000-7000-8000-0000000c000${i}`,
  metric: overMetric.id,
  value: String(value),
  checked_in_at: daysAgo((3 - i) * 7 + 2),
}));
export const overTargetSeries = lineSeries({ ...goals[2], target_date: null }, [overMetric], overCheckIns, false);

/** One check-in only: a single dot, the range padded around it. */
export const singlePointSeries: LineSeries[] = [{ ...revenueSeries[0], points: revenueSeries[0].points.slice(-1), projection: null }];

/** "Churn rate": target = base, so tracked - charted in its own unit. */
const churn = metrics.find((m) => m.name === "Churn rate") as Metric;
export const churnPoints = computeValueSeries(churn, checkIns);
export const churnDomain = panelDomain(revenueGoal, revenueSeries, [churnPoints]);
/** A tracked revenue in đ with readings from an AI agent and an ingest URL (see the tooltip). */
export const revenueVndPoints: ValuePoint[] = [1.2e9, 1.45e9, 1.38e9, 1.6e9, 1.92e9].map((value, i) => ({
  t: Date.parse(daysAgo((4 - i) * 9 + 2)),
  value,
  source: (["web", "agent", "ingest", "mobile", "web"] as const)[i],
}));

/** Current progress bars: every fixture goal, as the dashboard computes them. */
export const progressRows: BarRow[] = computeGoalProgress(goals, rootMetrics(metrics), checkIns).map((p, i) => ({
  progress: p,
  slot: i + 1,
}));
/** ...plus one with no metrics with a target, and one past 100%. */
export const mixedRows: BarRow[] = [
  ...progressRows,
  {
    progress: { goal: { ...goals[0], id: "05000000-0000-7000-8000-0000000000d1", title: "Track churn" }, metricCount: 1, current: null, series: [], lastCheckIn: null },
    slot: 4,
  },
  {
    progress: { goal: { ...goals[2], id: "05000000-0000-7000-8000-0000000000d2", title: "Sign-ups" }, metricCount: 1, current: 260, series: [], lastCheckIn: NOW - 2 * DAY },
    slot: 5,
    label: "Sign-ups · North",
  },
];

/** A SUM metric with a target of 10 calls a day, checked in most days for two weeks. */
export const callsMetric: Metric = {
  ...metrics[2],
  id: "06000000-0000-7000-8000-0000000000e1",
  name: "Sales calls",
  unit: "calls",
  aggregation: "sum",
  base_value: "0",
  target_value: "10",
  target_per: "day",
};
const callsCheckIns: CheckIn[] = [12, 8, 10, 0, 11, 6, 14, 9, 10, 3, 12, 10, 7, 11].flatMap((value, i) =>
  value === 0
    ? []
    : [{ ...checkIns[0], id: `07000000-0000-7000-8000-0000000e00${String(i).padStart(2, "0")}`, metric: callsMetric.id, value: String(value), checked_in_at: daysAgo(13 - i) }],
);
export const callsBars: PeriodBar[] = periodBars(callsMetric, callsCheckIns, "day", NOW, 14);
/** "Screens done" (amounts, no quota) snapped by week. */
export const screensBars: PeriodBar[] = periodBars(metrics[2], checkIns, "week", NOW);

// ---- The team board ----

const TEMPLATE_GOAL = "0b000000-0000-7000-8000-000000000001";
const TEMPLATE_GOAL_2 = "0b000000-0000-7000-8000-000000000002";
export const boardGoals: ChartGoal[] = [
  { id: TEMPLATE_GOAL, title: "Hit the quarter's sales", depth: 0 },
  { id: TEMPLATE_GOAL_2, title: "Keep customers happy", depth: 1 },
];

function boardMetric(id: string, goal: string, name: string, extra: Partial<BoardMetric> = {}): BoardMetric {
  return {
    id,
    template_goal: goal,
    parent: null,
    name,
    unit: "",
    aggregation: "latest",
    rollup: "sum",
    default_target: null,
    target_per: "",
    count_days: "all",
    progress_by: "total",
    one_per: "",
    snap_to: "",
    ...extra,
  };
}

export const boardMetrics: BoardMetric[] = [
  boardMetric("0c000000-0000-7000-8000-000000000001", TEMPLATE_GOAL, "Revenue", { unit: "$", aggregation: "sum" }),
  boardMetric("0c000000-0000-7000-8000-000000000002", TEMPLATE_GOAL, "Calls", { aggregation: "sum", target_per: "week" }),
  boardMetric("0c000000-0000-7000-8000-000000000003", TEMPLATE_GOAL_2, "NPS", { rollup: "avg" }),
  boardMetric("0c000000-0000-7000-8000-000000000004", TEMPLATE_GOAL_2, "Tickets open", { rollup: "sum" }),
];

const WEEKS = 8;
const weekStarts: number[] = [];
for (let s = periodStart(NOW, "week"), i = 0; i < WEEKS; i += 1, s = periodStart(s - DAY, "week")) weekStarts.unshift(s);
const ymd = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
/** The "Over time" periods' first days, oldest first, and their names. */
export const boardStarts: string[] = weekStarts.map(ymd);
export function boardLabel(start: string): string {
  const [y, m, d] = start.split("-").map(Number);
  return periodLabel(new Date(y, m - 1, d).getTime(), "week" as Snap);
}

function history(values: (number | null)[], quota: number | null = null): ShownNumbers[] {
  return weekStarts.map((start, i) => ({
    start: ymd(start),
    last: ymd(nextPeriodStart(start, "week") - DAY),
    value: values[i] ?? null,
    quota,
    count: values[i] === null ? 0 : 1,
    last_at: values[i] === null ? null : new Date(start + 2 * DAY).toISOString(),
  }));
}

function cell(id: string, base: number, target: number, current: number, extra: Partial<CellNumbers> = {}): CellNumbers {
  return {
    id,
    base_value: base,
    target_value: target,
    current_value: current,
    progress: target === base ? null : ((current - base) / (target - base)) * 100,
    check_in_due_at: null,
    last_checked_in_at: daysAgo(2),
    target_per: "",
    period_value: null,
    cumulative_target: null,
    expected_value: null,
    hit_rate: null,
    streak: null,
    pace: null,
    ...extra,
  };
}

const [revenue, calls, nps, tickets] = boardMetrics.map((m) => m.id);
function team(key: string, n: number, r: number[], c: (number | null)[], p: number, t: number): ChartSeries {
  return {
    key,
    label: key,
    total: false,
    metrics: {
      [revenue]: cell(`${key}-rev`, 0, 50000 + n * 10000, r.reduce((a, b) => a + b, 0), { history: history(r) }),
      [calls]: cell(`${key}-calls`, 0, 40, 0, {
        target_per: "week",
        pace: { per: "week", in_period: true, period_label: "This week", done: c[c.length - 1] ?? 0, quota: 40, left: 40 - (c[c.length - 1] ?? 0) },
        history: history(c, 40),
      }),
      [nps]: cell(`${key}-nps`, 20, 50, p, { history: history([p - 8, p - 5, null, p - 3, p - 2, p - 1, p, p]) }),
      [tickets]: cell(`${key}-tickets`, 0, 0, t, { history: history([t + 6, t + 4, t + 5, t + 3, t + 2, t + 2, t + 1, t]) }),
    },
  };
}

/** North, South and West (West has no NPS metric) and the Sales total. */
export const boardSeries: ChartSeries[] = (() => {
  const north = team("North", 1, [5000, 8000, 7000, 9000, 6000, 8000, 7500, 3000], [32, 41, 38, 45, 40, 36, 42, 18], 46, 4);
  const south = team("South", 0, [3000, 4000, 6000, 4000, 5000, 7000, 6500, 2000], [20, 28, null, 35, 30, 39, 41, 12], 34, 9);
  const west = team("West", 2, [0, 0, 2000, 6000, 9000, 12000, 11000, 4000], [null, null, 12, 25, 33, 44, 47, 22], 0, 2);
  delete west.metrics[nps];
  const total: ChartSeries = {
    key: "sales-total",
    label: "Sales",
    total: true,
    metrics: Object.fromEntries(
      boardMetrics.map((m) => {
        const parts = [north, south, west].map((s) => s.metrics[m.id]).filter(Boolean);
        const sum = (f: (c: CellNumbers) => number) => parts.reduce((a, c) => a + f(c), 0);
        return [
          m.id,
          cell(`total-${m.id}`, sum((c) => c.base_value), sum((c) => c.target_value), sum((c) => c.current_value), {
            history: weekStarts.map((_, i) => {
              const values = parts.map((c) => c.history?.[i]?.value).filter((v): v is number => v !== null && v !== undefined);
              return { ...(parts[0].history?.[i] as ShownNumbers), value: values.length ? values.reduce((a, b) => a + b, 0) : null, quota: null };
            }),
          }),
        ];
      }),
    ),
  };
  return [north, south, west, total];
})();

/** The board's own `chartPoint` (Check in mode, no "Show by"): the number each cell leads with. */
export function boardPoint(numbers: CellNumbers): ChartPoint {
  if (numbers.target_value === numbers.base_value) return { value: numbers.current_value, target: null, pct: null };
  if (numbers.target_per) {
    const pace = numbers.pace;
    if (!pace || pace.in_period === false || !pace.quota) return { value: numbers.current_value, target: null, pct: null };
    const done = pace.done ?? 0;
    return { value: done, target: pace.quota, pct: (done / pace.quota) * 100 };
  }
  return { value: numbers.current_value, target: numbers.target_value, pct: numbers.progress };
}
