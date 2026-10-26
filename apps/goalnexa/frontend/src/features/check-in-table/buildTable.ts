/**
 * The check-in table's rows and columns from the loaded goals, metrics and
 * check-ins - pure, so the screen just memoizes it.
 */
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import type { CheckIn } from "../../api/checkIns";
import {
  computeValueSeries,
  isTracked,
  metricPct,
  rootMetrics,
} from "../../lib/progress";
import { formatPct } from "../../components/charts/chartUtils";
import { buildTree, type TreeNode } from "../../components/GoalFilterList";
import { byPosition, goalGroup, metricGroup } from "../../lib/ordering";
import type { GoalPickerOption } from "../../components/GoalPicker";
import { bucketEnd, bucketKey, fmt, type Snap } from "./tableColumns";

/** What the table loads for one organization. */
export interface TableData {
  org: string;
  goals: Goal[];
  metrics: Metric[];
  checkIns: CheckIn[];
  /** Team id -> name, for the goal rows' team tags. */
  teamNames: Map<string, string>;
}

export interface Row {
  key: string;
  kind: "goal" | "metric";
  /** The goal or metric this row is. */
  id: string;
  /** A metric's goal (its own id for a goal row). */
  goalId: string;
  /** Its sibling group - rows are dragged within one (`lib/ordering.ts`). */
  group: string;
  depth: number;
  /** Ids of the goals/metrics this row hangs under - it's hidden while any of them is collapsed. */
  ancestors: string[];
  /** Has rows under it (sub-goals, metrics, sub-metrics) - gets a collapse toggle. */
  hasChildren: boolean;
  label: string;
  /** A goal row: the goal, for its team tag. */
  goal?: Goal;
  target?: string;
  /** Hover text explaining `target`. */
  targetTitle?: string;
  /** Column key -> display. */
  cells: Map<string, { main: string; sub?: string; title?: string }>;
  /** Column key -> number for the chart: progress in %, or a tracked metric's value. */
  points: Map<string, number>;
  /** A tracked metric (no target): its chart is in `unit`, not %. */
  tracked?: boolean;
  unit?: string;
}

export interface Table {
  columns: string[];
  rows: Row[];
}

/**
 * The table for `data`: picked goals and their sub-goals (none picked =
 * all), columns = the buckets their check-ins fall in, rows nested as in
 * the goal tree.
 */
export function buildTable(
  data: TableData,
  picked: Set<string>,
  snap: Snap,
  weekStart: number,
): Table {
  // Picked goals and their sub-goals; a pick that no longer exists is ignored.
  const parentOf = new Map(data.goals.map((g) => [g.id, g.parent]));
  const isShown = (id: string | null): boolean => {
    for (let at = id, hops = 0; at && hops <= data.goals.length; hops++) {
      if (picked.has(at)) return true;
      at = parentOf.get(at) ?? null;
    }
    return false;
  };
  const anyPicked = data.goals.some((g) => picked.has(g.id));
  const goals = anyPicked
    ? data.goals.filter((g) => isShown(g.id))
    : data.goals;
  const goalIds = new Set(goals.map((g) => g.id));
  const metrics = data.metrics.filter((m) => goalIds.has(m.goal));
  const metricIds = new Set(metrics.map((m) => m.id));
  const checkIns = data.checkIns.filter((c) => metricIds.has(c.metric));
  const columns = [
    ...new Set(
      checkIns.map((c) =>
        bucketKey(Date.parse(c.checked_in_at), snap, weekStart),
      ),
    ),
  ].sort();
  const metricsByGoal = new Map<string, Metric[]>();
  for (const m of metrics)
    metricsByGoal.set(m.goal, [...(metricsByGoal.get(m.goal) ?? []), m]);
  const sortedMetrics = (id: string) =>
    [...(metricsByGoal.get(id) ?? [])].sort(byPosition((m) => m.name));

  const metricRow = (
    m: Metric,
    depth: number,
    ancestors: string[],
    hasChildren: boolean,
  ): Row => {
    const series = computeValueSeries(m, checkIns);
    const tracked = isTracked(m);
    const unit = m.unit ? ` ${m.unit}` : "";
    const cells: Row["cells"] = new Map();
    const points: Row["points"] = new Map();
    const byDay = new Map<string, CheckIn[]>();
    for (const c of checkIns) {
      if (c.metric === m.id) {
        const k = bucketKey(Date.parse(c.checked_in_at), snap, weekStart);
        byDay.set(k, [...(byDay.get(k) ?? []), c]);
      }
    }
    for (const point of series) {
      const k = bucketKey(point.t, snap, weekStart);
      const day = byDay.get(k) ?? [];
      const notes = day
        .map((c) => c.note)
        .filter(Boolean)
        .join(" · ");
      const added =
        m.aggregation === "sum"
          ? day.reduce((s, c) => s + Number(c.value), 0)
          : null;
      cells.set(k, {
        main: `${fmt(point.value)}${unit}`,
        sub:
          added !== null
            ? `+${fmt(added)}`
            : tracked
              ? undefined
              : formatPct(metricPct(point.value, m)),
        title: notes || undefined,
      });
      points.set(k, tracked ? point.value : metricPct(point.value, m));
    }
    return {
      key: `m-${m.id}`,
      kind: "metric",
      id: m.id,
      goalId: m.goal,
      group: metricGroup(m),
      depth,
      ancestors,
      hasChildren,
      label: m.name,
      target: tracked
        ? "tracked"
        : `${fmt(Number(m.base_value))} → ${fmt(Number(m.target_value))}${unit}`,
      targetTitle: tracked
        ? `Tracked only: no target, so it has no % and doesn't count toward the goal's progress.${m.unit ? ` Unit: ${m.unit}.` : ""}`
        : `Starts at ${fmt(Number(m.base_value))}, target ${fmt(Number(m.target_value))}${m.unit ? ` (${m.unit})` : ""}. Progress is how far the value has moved from the start toward the target. ${
            m.aggregation === "sum"
              ? "Each check-in is an amount added to the running total."
              : "Each check-in is the new reading."
          }`,
      cells,
      points,
      tracked,
      unit: m.unit,
    };
  };

  const metricRows = (
    nodes: TreeNode<Metric>[],
    depth: number,
    ancestors: string[],
  ): Row[] =>
    nodes.flatMap((n) => [
      metricRow(n.item, depth, ancestors, n.children.length > 0),
      ...metricRows(n.children, depth + 1, [...ancestors, n.item.id]),
    ]);

  const goalRow = (
    goal: Goal,
    depth: number,
    ancestors: string[],
    hasChildren: boolean,
  ): Row => {
    const own = metricsByGoal.get(goal.id) ?? [];
    const usable = rootMetrics(own).filter((m) => !isTracked(m));
    const series = new Map(
      own.map((m) => [m.id, computeValueSeries(m, checkIns)]),
    );
    const cells: Row["cells"] = new Map();
    const points: Row["points"] = new Map();
    for (const col of columns) {
      const end = bucketEnd(col, snap);
      if (
        !own.some((m) =>
          (series.get(m.id) ?? []).some(
            (p) => bucketKey(p.t, snap, weekStart) === col,
          ),
        )
      )
        continue;
      if (usable.length === 0) continue;
      const pcts = usable.map((m) => {
        const upTo = (series.get(m.id) ?? []).filter((p) => p.t <= end);
        return metricPct(
          upTo.length ? upTo[upTo.length - 1].value : Number(m.base_value),
          m,
        );
      });
      const pct = pcts.reduce((s, v) => s + v, 0) / pcts.length;
      cells.set(col, { main: formatPct(pct) });
      points.set(col, pct);
    }
    return {
      key: `g-${goal.id}`,
      kind: "goal",
      id: goal.id,
      goalId: goal.id,
      group: goalGroup(goal),
      depth,
      ancestors,
      hasChildren,
      label: goal.title,
      goal,
      cells,
      points,
    };
  };

  const goalRows = (
    nodes: TreeNode<Goal>[],
    depth: number,
    ancestors: string[],
  ): Row[] =>
    nodes.flatMap((n) => {
      const inner = [...ancestors, n.item.id];
      const metrics = buildTree(sortedMetrics(n.item.id));
      return [
        goalRow(
          n.item,
          depth,
          ancestors,
          metrics.length > 0 || n.children.length > 0,
        ),
        ...metricRows(metrics, depth + 1, inner),
        ...goalRows(n.children, depth + 1, inner),
      ];
    });

  return { columns, rows: goalRows(buildTree(goals), 0, []) };
}

/** The goal picker's list: every goal, in the table's tree order. */
export function goalPickerOptions(goals: Goal[]): GoalPickerOption[] {
  const flatten = (
    nodes: TreeNode<Goal>[],
    depth: number,
  ): GoalPickerOption[] =>
    nodes.flatMap((n) => [
      { id: n.item.id, title: n.item.title, depth },
      ...flatten(n.children, depth + 1),
    ]);
  return flatten(buildTree(goals), 0);
}
