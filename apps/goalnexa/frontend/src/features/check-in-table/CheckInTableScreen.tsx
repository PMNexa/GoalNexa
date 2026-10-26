import { useMemo, useRef, useState } from "react";
import { Card, CardBody } from "platform-core";
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import { goalTeamName } from "../../api/dashboard";
import { PERSONAL_ORG } from "../../lib/currentOrg";
import { DASHBOARD_CSS } from "../../components/dashboardStyles";
import { BOARD_CHART_CSS } from "../../components/charts/BoardCharts";
import { TableCharts } from "./TableCharts";
import CheckInModal from "../../components/CheckInModal";
import CreateRecordModal, {
  type CreateTarget,
} from "../../components/CreateRecordModal";
import GoalTag from "../../components/GoalTag";
import { readStored, writeStored } from "../../lib/storedState";
import {
  applyOrder,
  byPosition,
  goalGroup,
  metricGroup,
  moveId,
  saveOrder,
  useSiblingDrag,
  type OrderKind,
} from "../../lib/ordering";
import { TABLE_CSS } from "./tableStyles";
import { bucketLabel, type Snap } from "./tableColumns";
import { buildTable, goalPickerOptions, type TableData } from "./buildTable";
import { chartCards } from "./chartCards";
import { useTableData } from "./useTableData";
import { useCheckInDraft } from "./useCheckInDraft";
import { TableToolbar, type TableView } from "./TableToolbar";
import { DraftColumnHeader } from "./DraftColumnHeader";
import { CheckInTableRow } from "./CheckInTableRow";

export interface CheckInTableScreenProps {
  accessToken: string;
}

const COLLAPSED_KEY = "goalnexa:table-collapsed";
const VIEW_KEY = "goalnexa:table-view";
/** Org key -> the goal ids picked to show there (none = all). */
const PICKED_KEY = "goalnexa:table-goals";

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
  const { orgKey, data, setData, error, reload } = useTableData(accessToken);
  const [snap, setSnap] = useState<Snap>("day");
  const [view, setViewState] = useState<TableView>(() => readStored<TableView>(VIEW_KEY, "table"));
  function setView(value: TableView) {
    setViewState(value);
    writeStored(VIEW_KEY, value);
    scrolledFor.current = null; // back to the table: open on the newest columns again
  }
  const [weekStart, setWeekStart] = useState(1);
  const [checkInFor, setCheckInFor] = useState<Metric | null>(null);
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
    let next: TableData;
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
      reload();
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

  /** A goal row's tag: "Total" on a team total, else its team - not on a sub-goal in its parent's team (or total). */
  function rowTag(goal: Goal) {
    if (!data) return null;
    const parent = goal.parent ? data.goals.find((g) => g.id === goal.parent) : undefined;
    if (parent && parent.team_id === goal.team_id && parent.is_rollup === goal.is_rollup) return null;
    return <GoalTag goal={goal} team={goalTeamName(goal, data.teamNames)} />;
  }

  const table = useMemo(() => {
    if (!data || data.org !== orgKey) return null;
    return buildTable(data, picked, snap, weekStart);
  }, [data, orgKey, snap, weekStart, picked]);

  // The goal picker's list: every goal, in the table's tree order.
  const goalOptions = useMemo(() => {
    if (!data || data.org !== orgKey) return [];
    return goalPickerOptions(data.goals);
  }, [data, orgKey]);

  const orgId = orgKey === PERSONAL_ORG ? null : orgKey;
  const goalTitle = (id: string) =>
    data?.goals.find((g) => g.id === id)?.title ?? "";
  const metricById = (id: string) =>
    data?.metrics.find((m) => m.id === id) ?? null;

  const draft = useCheckInDraft({
    accessToken,
    snap,
    weekStart,
    metricName: (id) => metricById(id)?.name,
    onSaved: reload,
  });

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
      {view === "chart" && (
        <style href="gn-board-charts" precedence="default">
          {BOARD_CHART_CSS}
        </style>
      )}
      <CheckInModal
        accessToken={accessToken}
        metric={checkInFor}
        goalTitle={checkInFor ? goalTitle(checkInFor.goal) : undefined}
        onClose={() => setCheckInFor(null)}
        onSaved={() => {
          setCheckInFor(null);
          reload();
        }}
      />
      <CreateRecordModal
        accessToken={accessToken}
        target={createTarget}
        onCreated={reload}
        onClose={() => setCreateTarget(null)}
      />
      <TableToolbar
        goalOptions={goalOptions}
        picked={picked}
        onPickedChange={changePicked}
        pickerDisabled={!table}
        onNewGoal={() => addGoal(null)}
        newGoalDisabled={orgKey === null}
        view={view}
        onViewChange={setView}
        snap={snap}
        onSnapChange={setSnap}
        weekStart={weekStart}
        onWeekStartChange={setWeekStart}
      />
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
          ) : view === "chart" ? (
            <TableCharts cards={chartCards(table, data?.teamNames)} columns={table.columns} label={(col) => bucketLabel(col, snap)} />
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
                    <DraftColumnHeader
                      snap={snap}
                      value={draft.draftInputValue}
                      onChange={draft.changeDraft}
                      filledCount={draft.filledCount}
                      hasTime={!!draft.draftWhen}
                      saving={draft.saving}
                      saveError={draft.saveError}
                      onSave={draft.saveDraft}
                    />
                  </tr>
                </thead>
                <tbody>
                  {table.rows
                    .filter(
                      (row) => !row.ancestors.some((id) => collapsed.has(id)),
                    )
                    .map((row) => (
                      <CheckInTableRow
                        key={row.key}
                        row={row}
                        columns={table.columns}
                        drag={dragRow(row.kind, row.id, row.group)}
                        collapsed={collapsed.has(row.id)}
                        onToggleCollapsed={() => toggleCollapsed(row.id)}
                        tag={row.goal && rowTag(row.goal)}
                        menuItems={
                          row.kind === "goal"
                            ? [
                                {
                                  label: "Add metric",
                                  onSelect: () => addMetric(row.id, null),
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
                        draftValue={draft.draftValues[row.id] ?? ""}
                        draftPlaceholder={
                          metricById(row.id)?.aggregation === "sum"
                            ? "+ amount"
                            : (metricById(row.id)?.unit ?? "")
                        }
                        onDraftChange={(value) => draft.setDraftValue(row.id, value)}
                        onDraftSubmit={() => void draft.saveDraft()}
                      />
                    ))}
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
