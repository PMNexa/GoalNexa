import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardBody, FormLabel } from "platform-core";
import type { Goal } from "../lib/api/goals";
import type { Metric } from "../lib/api/metrics";
import type { CheckIn } from "../lib/api/checkIns";
import {
  fetchAll,
  fetchGoals,
  fetchOrgs,
  type OrgOption,
} from "../lib/api/dashboard";
import { apiRequest } from "../lib/api/client";
import {
  getCurrentOrg,
  PERSONAL_ORG,
  setCurrentOrg,
  subscribeCurrentOrg,
} from "../lib/currentOrg";
import {
  computeValueSeries,
  isTracked,
  metricPct,
  rootMetrics,
} from "../lib/progress";
import { formatPct } from "./dashboard/chartUtils";
import { DASHBOARD_CSS } from "./dashboard/dashboardStyles";
import CheckInModal from "./dashboard/CheckInModal";
import CreateRecordModal, {
  type CreateTarget,
} from "./dashboard/CreateRecordModal";
import RowMenu from "./dashboard/RowMenu";
import {
  buildTree,
  CollapseToggle,
  type TreeNode,
} from "./dashboard/GoalFilterList";
import { readStored, writeStored } from "../lib/storedState";
import {
  applyOrder,
  byPosition,
  goalGroup,
  metricGroup,
  moveId,
  saveOrder,
  useSiblingDrag,
  type OrderKind,
} from "../lib/ordering";
import GoalPicker, { type GoalPickerOption } from "./GoalPicker";

export interface CheckInTableScreenProps {
  accessToken: string;
}

const CHUNK = 40;
const COLLAPSED_KEY = "goalnexa:table-collapsed";
/** Org key -> the goal ids picked to show there (none = all). */
const PICKED_KEY = "goalnexa:table-goals";

const PlusIcon = (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M12 5l0 14" />
    <path d="M5 12l14 0" />
  </svg>
);

const TABLE_CSS = `.gn-table-wrap { overflow: auto; max-height: calc(100vh - 14rem); }
.gn-table { border-collapse: separate; border-spacing: 0; font-size: .85rem; min-width: 100%; }
.gn-table .gn-fill { width: 100%; padding: 0; }
.gn-table .gn-draft { position: sticky; right: 0; min-width: 15rem; box-shadow: inset 1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-table thead .gn-draft { z-index: 3; text-align: left; }
.gn-table tbody .gn-draft { z-index: 1; }
.gn-table tr.gn-goal-row .gn-draft { background: var(--tblr-bg-surface-secondary, #f6f8fb); }
.gn-table th, .gn-table td { padding: .35rem .6rem; white-space: nowrap; border-bottom: 1px solid var(--tblr-border-color, #e6e7e9); background: var(--tblr-bg-surface, #fff); }
.gn-table thead th { position: sticky; top: 0; z-index: 2; text-align: right; font-weight: 600; }
.gn-table .gn-sticky { position: sticky; left: 0; z-index: 1; text-align: left; min-width: 16rem; max-width: 22rem; box-shadow: inset -1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-table thead .gn-sticky { z-index: 3; overflow: visible; }
.gn-table tbody .gn-sticky:has(.dropdown-menu.show), .gn-table tbody .gn-sticky:focus-within { z-index: 10; }
.gn-table td.gn-cell { text-align: right; font-variant-numeric: tabular-nums; }
.gn-table tr.gn-goal-row th, .gn-table tr.gn-goal-row td { font-weight: 600; background: var(--tblr-bg-surface-secondary, #f6f8fb); }
.gn-table .gn-sub { display: block; font-size: .7rem; color: var(--tblr-secondary, #667382); font-weight: 400; }
.gn-table tbody th[draggable="true"] { cursor: grab; }
.gn-table tbody tr[data-dragging] > * { opacity: .5; }
.gn-table tbody tr[data-drop="before"] > * { box-shadow: inset 0 2px 0 var(--tblr-primary, #066fd1); }
.gn-table tbody tr[data-drop="after"] > * { box-shadow: inset 0 -2px 0 var(--tblr-primary, #066fd1); }
.gn-table .gn-collapse { color: var(--tblr-secondary, #667382); flex-shrink: 0; }
.gn-table .gn-collapse-gap { display: inline-block; width: 1.25rem; flex-shrink: 0; }
.gn-table .gn-target { color: var(--tblr-secondary, #667382); text-align: right; }
`;

interface Row {
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
  target?: string;
  /** Hover text explaining `target`. */
  targetTitle?: string;
  /** Column key -> display. */
  cells: Map<string, { main: string; sub?: string; title?: string }>;
}

/** Now, as a `datetime-local` value (local time, minutes). */
function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** What check-ins are grouped by: each column is one hour, day, week (from the chosen weekday) or month. */
type Snap = "hour" | "day" | "week" | "month";
const SNAPS: { value: Snap; label: string }[] = [
  { value: "hour", label: "Hour" },
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** The first day of the week (per `weekStart`, 0 = Sunday) that `date` ("YYYY-MM-DD") falls in. */
function weekStartOf(date: string, weekStart: number): string {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  return dateKey(d);
}

const two = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** The column a moment falls in: a sortable key (hour `2026-10-09T13`, day/week `2026-10-09` (the day a week starts), month `2026-10`). */
function bucketKey(t: number, snap: Snap, weekStart: number): string {
  const d = new Date(t);
  if (snap === "hour") return `${dateKey(d)}T${two(d.getHours())}`;
  if (snap === "month") return `${d.getFullYear()}-${two(d.getMonth() + 1)}`;
  if (snap === "week")
    d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  return dateKey(d);
}

/** The last instant of a column. */
function bucketEnd(key: string, snap: Snap): number {
  if (snap === "hour") return new Date(`${key}:59:59.999`).getTime();
  if (snap === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m, 0, 23, 59, 59, 999).getTime();
  }
  const end = new Date(`${key}T23:59:59.999`);
  if (snap === "week") end.setDate(end.getDate() + 6);
  return end.getTime();
}

function bucketLabel(key: string, snap: Snap): string {
  const thisYear = new Date().getFullYear();
  if (snap === "month") {
    const d = new Date(`${key}-01T00:00`);
    return d.toLocaleDateString(
      undefined,
      d.getFullYear() === thisYear
        ? { month: "long" }
        : { month: "short", year: "numeric" },
    );
  }
  const d = new Date(snap === "hour" ? `${key}:00` : `${key}T00:00`);
  const date = d.toLocaleDateString(
    undefined,
    d.getFullYear() === thisYear
      ? { month: "short", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric" },
  );
  if (snap === "hour")
    return `${date}, ${d.toLocaleTimeString(undefined, { hour: "numeric" })}`;
  return snap === "week" ? `Week of ${date}` : date;
}
const fmt = (n: number) =>
  new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(n);

async function loadAll(accessToken: string, goals: Goal[]) {
  const metrics: Metric[] = [];
  const checkIns: CheckIn[] = [];
  const ids = goals.map((g) => g.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK).join(",");
    metrics.push(
      ...(await fetchAll<Metric>(
        `/api/v1/metrics?filter{goal.in}=${part}`,
        accessToken,
      )),
    );
    checkIns.push(
      ...(await fetchAll<CheckIn>(
        `/api/v1/check-ins?filter{metric.goal.in}=${part}`,
        accessToken,
      )),
    );
  }
  return { metrics, checkIns };
}

/**
 * A spreadsheet view of the same data as the dashboard: rows are goals,
 * sub-goals, metrics and sub-metrics (nested as in the goal tree); columns
 * are the days something was checked in. A metric's cell is its reading
 * after that day's last check-in (a `sum` metric: the running total, with
 * the amount added under it), with its % of the way to target; a goal's is
 * its progress that day (the mean of its root metrics, as the dashboard
 * computes it), shown only on days one of its own metrics was checked in.
 */
function CheckInTableScreen({ accessToken }: CheckInTableScreenProps) {
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [orgKey, setOrgKey] = useState<string | null>(null);
  const [data, setData] = useState<{
    org: string;
    goals: Goal[];
    metrics: Metric[];
    checkIns: CheckIn[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [snap, setSnap] = useState<Snap>("day");
  const [weekStart, setWeekStart] = useState(1);
  const [checkInFor, setCheckInFor] = useState<Metric | null>(null);
  // The new check-in column: one time for the whole column, a value per metric.
  const [draftWhen, setDraftWhen] = useState(nowLocal);
  const [draftValues, setDraftValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const scrolledFor = useRef<string | null>(null);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  // Collapsed goal/metric ids, remembered per browser.
  const [collapsed, setCollapsed] = useState<Set<string>>(
    () => new Set(readStored<string[]>(COLLAPSED_KEY, [])),
  );
  const [orderError, setOrderError] = useState<string | null>(null);
  // Goals picked to show, per organization, remembered per browser.
  const [pickedByOrg, setPickedByOrg] = useState<Record<string, string[]>>(
    () => readStored<Record<string, string[]>>(PICKED_KEY, {}),
  );
  const picked = useMemo(
    () => new Set(orgKey ? (pickedByOrg[orgKey] ?? []) : []),
    [pickedByOrg, orgKey],
  );

  function changePicked(next: Set<string>) {
    if (!orgKey) return;
    setPickedByOrg((prev) => {
      const updated = { ...prev, [orgKey]: [...next] };
      writeStored(PICKED_KEY, updated);
      return updated;
    });
  }

  // Drag and drop within a sibling group: shown at once, then saved; a
  // failed save reloads the table's order from the server.
  function moveRow(
    kind: OrderKind,
    dragged: string,
    target: string,
    after: boolean,
  ) {
    if (!data) return;
    let ids: string[];
    let next: typeof data;
    if (kind === "goal") {
      const goal = data.goals.find((g) => g.id === dragged);
      if (!goal) return;
      const siblings = data.goals
        .filter((g) => goalGroup(g) === goalGroup(goal))
        .sort(byPosition((g) => g.title));
      ids = moveId(
        siblings.map((g) => g.id),
        dragged,
        target,
        after,
      );
      next = { ...data, goals: applyOrder(data.goals, ids, (g) => g.title) };
    } else {
      const metric = data.metrics.find((m) => m.id === dragged);
      if (!metric) return;
      const siblings = data.metrics
        .filter((m) => metricGroup(m) === metricGroup(metric))
        .sort(byPosition((m) => m.name));
      ids = moveId(
        siblings.map((m) => m.id),
        dragged,
        target,
        after,
      );
      next = { ...data, metrics: applyOrder(data.metrics, ids, (m) => m.name) };
    }
    setData(next);
    setOrderError(null);
    saveOrder(accessToken, kind, ids).catch((e) => {
      setOrderError(`Couldn't save the new order: ${String(e?.message ?? e)}`);
      setVersion((v) => v + 1);
    });
  }
  const dragRow = useSiblingDrag(moveRow);

  function toggleCollapsed(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeStored(COLLAPSED_KEY, [...next]);
      return next;
    });
  }

  useEffect(() => {
    let live = true;
    fetchOrgs(accessToken)
      .then((items) => {
        if (!live) return;
        setOrgs(items);
        const stored = getCurrentOrg();
        const valid =
          stored === PERSONAL_ORG || items.some((org) => org.id === stored);
        setOrgKey(valid && stored ? stored : (items[0]?.id ?? PERSONAL_ORG));
      })
      .catch((e) => live && setError(String(e?.message ?? e)));
    const unsubscribe = subscribeCurrentOrg(() => {
      const next = getCurrentOrg();
      if (next) setOrgKey(next);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [accessToken]);

  useEffect(() => {
    if (orgKey === null) return;
    let live = true;
    setError(null);
    fetchGoals(accessToken, orgKey === PERSONAL_ORG ? null : orgKey)
      .then(async (all) => {
        const goals = all.filter((g) => g.status !== "archived");
        const rest = await loadAll(accessToken, goals);
        if (live) setData({ org: orgKey, goals, ...rest });
      })
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, [accessToken, orgKey, version]);

  const table = useMemo(() => {
    if (!data || data.org !== orgKey) return null;
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
        cells.set(col, {
          main: formatPct(pcts.reduce((s, v) => s + v, 0) / pcts.length),
        });
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
        cells,
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
  }, [data, orgKey, snap, weekStart, picked]);

  // The goal picker's list: every goal, in the table's tree order.
  const goalOptions = useMemo(() => {
    if (!data || data.org !== orgKey) return [];
    const flatten = (
      nodes: TreeNode<Goal>[],
      depth: number,
    ): GoalPickerOption[] =>
      nodes.flatMap((n) => [
        { id: n.item.id, title: n.item.title, depth },
        ...flatten(n.children, depth + 1),
      ]);
    return flatten(buildTree(data.goals), 0);
  }, [data, orgKey]);

  const filled = Object.entries(draftValues).filter(
    ([, v]) => v.trim() !== "" && Number.isFinite(Number(v)),
  );

  // The picker follows the column size; the draft itself stays one local date-time, whose time of day is kept.
  const draftInputValue =
    snap === "hour"
      ? `${draftWhen.slice(0, 13)}:00`
      : snap === "month"
        ? draftWhen.slice(0, 7)
        : snap === "week"
          ? weekStartOf(draftWhen.slice(0, 10), weekStart)
          : draftWhen.slice(0, 10);

  function changeDraft(value: string) {
    if (!value) return;
    const time = draftWhen.slice(10);
    if (snap === "hour") setDraftWhen(value);
    else if (snap === "month") setDraftWhen(`${value}-01${time}`);
    else if (snap === "week")
      setDraftWhen(`${weekStartOf(value, weekStart)}${time}`);
    else setDraftWhen(`${value}${time}`);
  }

  async function saveDraft() {
    if (filled.length === 0 || !draftWhen) return;
    setSaving(true);
    setSaveError(null);
    // Picking the current hour/day/week/month means "now"; any other column keeps the draft's own time.
    const chosen = new Date(
      `${snap === "hour" ? draftWhen.slice(0, 13) + ":00" : draftWhen}`,
    );
    const when = (
      bucketKey(chosen.getTime(), snap, weekStart) ===
      bucketKey(Date.now(), snap, weekStart)
        ? new Date()
        : chosen
    ).toISOString();
    const failed: string[] = [];
    for (const [metric, value] of filled) {
      try {
        await apiRequest<CheckIn>("/api/v1/check-ins", accessToken, {
          method: "POST",
          data: { metric, value: Number(value), checked_in_at: when },
        });
        setDraftValues((prev) => {
          const { [metric]: _saved, ...rest } = prev;
          return rest;
        });
      } catch {
        failed.push(metricById(metric)?.name ?? metric);
      }
    }
    setSaving(false);
    if (failed.length) setSaveError(`Couldn't save: ${failed.join(", ")}`);
    else setDraftWhen(nowLocal());
    setVersion((v) => v + 1);
  }

  const orgId = orgKey === PERSONAL_ORG ? null : orgKey;
  const goalTitle = (id: string) =>
    data?.goals.find((g) => g.id === id)?.title ?? "";
  const metricById = (id: string) =>
    data?.metrics.find((m) => m.id === id) ?? null;

  function addGoal(parentGoalId: string | null) {
    setCreateTarget({
      endpoint: "/api/v1/goals",
      title: parentGoalId
        ? `New sub-goal of ${goalTitle(parentGoalId)}`
        : "New goal",
      preset: {
        org_id: orgId,
        ...(parentGoalId ? { parent: parentGoalId } : {}),
      },
    });
  }

  function addMetric(goalId: string, parentMetricId: string | null) {
    setCreateTarget({
      endpoint: "/api/v1/metrics",
      title: parentMetricId
        ? `New sub-metric of ${metricById(parentMetricId)?.name ?? ""}`
        : `New metric for ${goalTitle(goalId)}`,
      preset: {
        goal: goalId,
        ...(parentMetricId ? { parent: parentMetricId } : {}),
      },
    });
  }

  return (
    <div>
      <style href="goalnexa-dashboard" precedence="default">
        {DASHBOARD_CSS}
      </style>
      <style href="gn-checkin-table" precedence="default">
        {TABLE_CSS}
      </style>
      <CheckInModal
        accessToken={accessToken}
        metric={checkInFor}
        goalTitle={checkInFor ? goalTitle(checkInFor.goal) : undefined}
        onClose={() => setCheckInFor(null)}
        onSaved={() => {
          setCheckInFor(null);
          setVersion((v) => v + 1);
        }}
      />
      <CreateRecordModal
        accessToken={accessToken}
        target={createTarget}
        onCreated={() => setVersion((v) => v + 1)}
        onClose={() => setCreateTarget(null)}
      />
      <div className="d-flex align-items-end gap-3 mb-3">
        <div>
          <FormLabel htmlFor="table-org">Organization</FormLabel>
          <select
            id="table-org"
            className="form-select form-select-sm w-auto"
            value={orgKey ?? ""}
            onChange={(event) => setCurrentOrg(event.target.value)}
          >
            {(orgs ?? []).map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
            <option value={PERSONAL_ORG}>Personal (no organization)</option>
          </select>
        </div>
        <div>
          <FormLabel>Goals</FormLabel>
          <GoalPicker
            options={goalOptions}
            selected={picked}
            onChange={changePicked}
            disabled={!table}
          />
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => addGoal(null)}
          disabled={orgKey === null}
        >
          New goal
        </button>
        <div className="ms-auto">
          <FormLabel htmlFor="table-snap">Snap to</FormLabel>
          <div className="d-flex gap-2">
            <select
              id="table-snap"
              className="form-select form-select-sm w-auto"
              value={snap}
              onChange={(event) => setSnap(event.target.value as Snap)}
            >
              {SNAPS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {snap === "week" && (
              <select
                aria-label="Week starts on"
                title="Week starts on"
                className="form-select form-select-sm w-auto"
                value={weekStart}
                onChange={(event) => setWeekStart(Number(event.target.value))}
              >
                {WEEKDAYS.map((name, day) => (
                  <option key={name} value={day}>
                    {name}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>
      {orderError && (
        <div className="alert alert-danger py-2">{orderError}</div>
      )}
      <Card>
        <CardBody className="p-0">
          {error ? (
            <div className="text-danger p-3">{error}</div>
          ) : !table ? (
            <div className="text-secondary p-3">Loading…</div>
          ) : table.rows.length === 0 ? (
            <div className="text-secondary p-3">No goals yet.</div>
          ) : (
            <div
              className="gn-table-wrap"
              ref={(el) => {
                // Open on the newest columns, once per organization (not on every keystroke).
                if (el && scrolledFor.current !== orgKey) {
                  scrolledFor.current = orgKey;
                  el.scrollLeft = el.scrollWidth;
                }
              }}
            >
              <table className="gn-table">
                <thead>
                  <tr>
                    <th className="gn-sticky">Goal / metric</th>
                    <th>Target</th>
                    {table.columns.map((col) => (
                      <th key={col}>{bucketLabel(col, snap)}</th>
                    ))}
                    <th className="gn-fill" aria-hidden="true" />
                    <th className="gn-draft">
                      <div className="d-flex align-items-center gap-2">
                        <input
                          type={
                            snap === "hour"
                              ? "datetime-local"
                              : snap === "month"
                                ? "month"
                                : "date"
                          }
                          step={snap === "hour" ? 3600 : undefined}
                          className="form-control form-control-sm"
                          aria-label={`New check-in ${snap}`}
                          title={
                            snap === "week"
                              ? "The week it counts for (starts on the day chosen above)"
                              : undefined
                          }
                          value={draftInputValue}
                          onChange={(event) => changeDraft(event.target.value)}
                        />
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          disabled={saving || filled.length === 0 || !draftWhen}
                          onClick={saveDraft}
                        >
                          {saving
                            ? "Saving…"
                            : filled.length
                              ? `Save ${filled.length}`
                              : "Save"}
                        </button>
                      </div>
                      {saveError && (
                        <span className="gn-sub text-danger">{saveError}</span>
                      )}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {table.rows
                    .filter(
                      (row) => !row.ancestors.some((id) => collapsed.has(id)),
                    )
                    .map((row) => {
                      const drag = dragRow(row.kind, row.id, row.group);
                      return (
                        <tr
                          key={row.key}
                          className={
                            row.kind === "goal" ? "gn-goal-row" : undefined
                          }
                          {...drag.target}
                        >
                          <th
                            className="gn-sticky"
                            scope="row"
                            style={{
                              paddingLeft: `${0.6 + row.depth * 1.1}rem`,
                              fontWeight: row.kind === "goal" ? 600 : 400,
                            }}
                            title={`${row.label}\nDrag to reorder`}
                            {...drag.source}
                          >
                            <span className="d-flex align-items-center gap-1">
                              {row.hasChildren ? (
                                <CollapseToggle
                                  collapsed={collapsed.has(row.id)}
                                  name={row.label}
                                  onToggle={() => toggleCollapsed(row.id)}
                                />
                              ) : (
                                <span
                                  className="gn-collapse-gap"
                                  aria-hidden="true"
                                />
                              )}
                              <span className="flex-grow-1 text-truncate">
                                {row.label}
                              </span>
                              <RowMenu
                                label={`Add to ${row.label}`}
                                icon={PlusIcon}
                                items={
                                  row.kind === "goal"
                                    ? [
                                        {
                                          label: "Add metric",
                                          onSelect: () =>
                                            addMetric(row.id, null),
                                        },
                                        {
                                          label: "Add sub-goal",
                                          onSelect: () => addGoal(row.id),
                                        },
                                      ]
                                    : [
                                        {
                                          label: "Check in",
                                          onSelect: () =>
                                            setCheckInFor(metricById(row.id)),
                                        },
                                        {
                                          label: "Add sub-metric",
                                          onSelect: () =>
                                            addMetric(row.goalId, row.id),
                                        },
                                      ]
                                }
                              />
                            </span>
                          </th>
                          <td className="gn-target" title={row.targetTitle}>
                            {row.target ?? ""}
                          </td>
                          {table.columns.map((col) => {
                            const cell = row.cells.get(col);
                            return (
                              <td
                                key={col}
                                className="gn-cell"
                                title={cell?.title}
                              >
                                {cell && (
                                  <>
                                    {cell.main}
                                    {cell.sub && (
                                      <span className="gn-sub">{cell.sub}</span>
                                    )}
                                  </>
                                )}
                              </td>
                            );
                          })}
                          <td className="gn-fill" />
                          <td className="gn-draft">
                            {row.kind === "metric" && (
                              <input
                                type="number"
                                step="any"
                                className="form-control form-control-sm text-end"
                                aria-label={`New check-in for ${row.label}`}
                                placeholder={
                                  metricById(row.id)?.aggregation === "sum"
                                    ? "+ amount"
                                    : (metricById(row.id)?.unit ?? "")
                                }
                                value={draftValues[row.id] ?? ""}
                                onChange={(event) =>
                                  setDraftValues((prev) => ({
                                    ...prev,
                                    [row.id]: event.target.value,
                                  }))
                                }
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") void saveDraft();
                                }}
                              />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default CheckInTableScreen;
