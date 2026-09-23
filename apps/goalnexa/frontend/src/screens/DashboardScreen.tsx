import { useEffect, useMemo, useRef, useState } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CrudDetailScreen,
  Drawer,
  FormLabel,
  type LinkComponent,
} from "platform-core";
import type { Goal } from "../lib/api/goals";
import type { Metric } from "../lib/api/metrics";
import {
  fetchCheckIns,
  fetchGoals,
  fetchMetrics,
  fetchOrgs,
  type OrgOption,
} from "../lib/api/dashboard";
import type { CheckIn } from "../lib/api/checkIns";
import { computeGoalProgress, computeMetricSeries, type ProgressPoint } from "../lib/progress";
import ProgressBarChart from "./dashboard/ProgressBarChart";
import CheckInModal from "./dashboard/CheckInModal";
import GoalFilterList from "./dashboard/GoalFilterList";
import ProgressLineChart, { fitDomain } from "./dashboard/ProgressLineChart";
import { formatPct } from "./dashboard/chartUtils";
import { DASHBOARD_CSS } from "./dashboard/dashboardStyles";

export interface DashboardScreenProps {
  accessToken: string;
  /** For links inside the details drawer (Edit, related rows) - same as `CrudDetailScreen`'s. */
  linkComponent?: LinkComponent;
  /** Where each resource's pages are mounted - same as `CrudDetailScreen`'s. */
  resourcePath?: (endpoint: string) => string | null;
}

/** What the details drawer shows: a goal or a metric, by its API base URL. */
interface DetailTarget {
  endpoint: "/api/v1/goals" | "/api/v1/metrics";
  id: string;
}

/** Palette has 8 validated categorical slots - a 9th series would need a generated hue, so selection stops at 8. */
const MAX_GOALS = 8;
const PERSONAL = "__personal__";
/** The picked org is remembered per browser; a storage failure just means it isn't. */
const ORG_STORAGE_KEY = "goalnexa:dashboard-org";

function readStoredOrg(): string | null {
  try {
    return window.localStorage.getItem(ORG_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeOrg(key: string) {
  try {
    window.localStorage.setItem(ORG_STORAGE_KEY, key);
  } catch {
    // Not remembered - nothing else depends on it.
  }
}

function formatAmount(value: string | number): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function toError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

/** Lowest color slot (1-8) not already held by a selected goal. */
function freeSlot(slots: Map<string, number>): number {
  const taken = new Set(slots.values());
  for (let slot = 1; slot <= MAX_GOALS; slot += 1) if (!taken.has(slot)) return slot;
  return MAX_GOALS;
}

/**
 * Goal dashboard: pick ONE org (or personal goals), pick up to 8 of its
 * goals, see their progress over time + where each stands now. Each
 * selected goal lists its metrics: unticking one leaves it out of that
 * goal's progress (both charts), and "Check in" logs a reading
 * inline - the charts refresh in place. A goal's or metric's name opens
 * platform-core's `CrudDetailScreen` in a right-hand drawer. Progress
 * math lives in `lib/progress.ts`; charts are plain SVG
 * (`dashboard/`), no chart library. Self-contained like every screen in
 * this package - `accessToken` in, no router dependency.
 */
function DashboardScreen({ accessToken, linkComponent, resourcePath }: DashboardScreenProps) {
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [orgKey, setOrgKey] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  // goal id -> color slot, in selection order. A goal keeps its slot for
  // as long as it's selected, so (de)selecting others never repaints it.
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  // Opt-out, not opt-in: every metric counts until unticked, so a goal's
  // progress matches the rest of the app by default.
  const [disabledMetrics, setDisabledMetrics] = useState<Set<string>>(new Set());
  const [checkInFor, setCheckInFor] = useState<string | null>(null);
  // Bumped after an inline check-in - refetches metrics/check-ins without
  // flashing the charts back to "Loading…" (see the effect below).
  const [seriesVersion, setSeriesVersion] = useState(0);
  const loadedKeyRef = useRef<string | null>(null);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchOrgs(accessToken)
      .then((items) => {
        if (cancelled) return;
        setOrgs(items);
        // The last pick, if it's still one of this user's orgs.
        const stored = readStoredOrg();
        const valid = stored === PERSONAL || items.some((org) => org.id === stored);
        setOrgKey(valid && stored ? stored : (items[0]?.id ?? PERSONAL));
      })
      .catch((thrown: unknown) => !cancelled && setError(toError(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  useEffect(() => {
    if (orgKey === null) return;
    let cancelled = false;
    setGoals(null);
    setSelected(new Map());
    fetchGoals(accessToken, orgKey === PERSONAL ? null : orgKey)
      .then((items) => {
        if (cancelled) return;
        setGoals(items);
        // Start with the first few goals selected so the page opens on a chart.
        setSelected(new Map(items.slice(0, MAX_GOALS).map((goal, i) => [goal.id, i + 1])));
      })
      .catch((thrown: unknown) => !cancelled && setError(toError(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, orgKey]);

  const selectedIds = useMemo(() => [...selected.keys()].sort(), [selected]);
  const selectedKey = selectedIds.join(",");

  useEffect(() => {
    if (selectedIds.length === 0) {
      setMetrics([]);
      setCheckIns([]);
      return;
    }
    let cancelled = false;
    // A new selection shows "Loading…"; a refresh of the same one doesn't.
    if (loadedKeyRef.current !== selectedKey) setLoadingSeries(true);
    Promise.all([fetchMetrics(accessToken, selectedIds), fetchCheckIns(accessToken, selectedIds)])
      .then(([metricItems, checkInItems]) => {
        if (cancelled) return;
        setMetrics(metricItems);
        setCheckIns(checkInItems);
        loadedKeyRef.current = selectedKey;
      })
      .catch((thrown: unknown) => !cancelled && setError(toError(thrown)))
      .finally(() => !cancelled && setLoadingSeries(false));
    return () => {
      cancelled = true;
    };
    // selectedKey stands in for selectedIds (a new array every render of `selected`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, selectedKey, seriesVersion]);

  const progress = useMemo(() => {
    const selectedGoals = (goals ?? []).filter((goal) => selected.has(goal.id));
    const enabledMetrics = metrics.filter((metric) => !disabledMetrics.has(metric.id));
    return computeGoalProgress(selectedGoals, enabledMetrics, checkIns);
  }, [goals, selected, metrics, checkIns, disabledMetrics]);

  const metricsByGoal = useMemo(() => {
    const byGoal = new Map<string, Metric[]>();
    for (const metric of [...metrics].sort((a, b) => a.name.localeCompare(b.name))) {
      byGoal.set(metric.goal, [...(byGoal.get(metric.goal) ?? []), metric]);
    }
    return byGoal;
  }, [metrics]);

  // A metric's line color = its position among its goal's metrics (by
  // name) - stable while other metrics are shown/hidden. The palette has
  // 8 validated slots, so a goal's 9th+ metric isn't charted (never a
  // cycled/generated color); its panel says how many were left out.
  const metricSlot = useMemo(() => {
    const slots = new Map<string, number>();
    for (const goalMetrics of metricsByGoal.values()) {
      goalMetrics.forEach((metric, i) => {
        if (i < MAX_GOALS) slots.set(metric.id, i + 1);
      });
    }
    return slots;
  }, [metricsByGoal]);

  // Small multiples: one progress-over-time panel per shown goal, one line
  // per shown metric - a single chart could need more lines than the
  // palette has colors.
  const metricPanels = useMemo(
    () =>
      progress.map((p) => {
        const shownMetrics = (metricsByGoal.get(p.goal.id) ?? []).filter((metric) => !disabledMetrics.has(metric.id));
        const charted = shownMetrics.filter((metric) => metricSlot.has(metric.id));
        return {
          progress: p,
          overflow: shownMetrics.length - charted.length,
          series: charted.map((metric) => ({
            id: metric.id,
            label: metric.name,
            slot: metricSlot.get(metric.id) as number,
            points: computeMetricSeries(metric, checkIns),
            formatDetail: (point: ProgressPoint) =>
              point.value === undefined
                ? null
                : `${formatAmount(point.value)} / ${formatAmount(metric.target_value)}${metric.unit ? ` ${metric.unit}` : ""}`,
          })),
        };
      }),
    [progress, metricsByGoal, disabledMetrics, metricSlot, checkIns],
  );

  // One shared time range + % ceiling across every panel.
  const panelDomain = useMemo(
    () => fitDomain(metricPanels.flatMap((panel) => panel.series.flatMap((line) => line.points))) ?? undefined,
    [metricPanels],
  );

  const checkInMetric = metrics.find((metric) => metric.id === checkInFor) ?? null;
  const currentByGoal = useMemo(() => new Map(progress.map((p) => [p.goal.id, p.current])), [progress]);

  function toggleMetric(metricId: string) {
    setDisabledMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId);
      else next.add(metricId);
      return next;
    });
  }

  function toggleGoal(goalId: string) {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(goalId)) next.delete(goalId);
      else if (next.size < MAX_GOALS) next.set(goalId, freeSlot(next));
      return next;
    });
  }

  function selectFirst() {
    setSelected(new Map((goals ?? []).slice(0, MAX_GOALS).map((goal, i) => [goal.id, i + 1])));
  }

  // Anything may have changed in the drawer (a check-in, a metric's
  // target), so closing it refreshes the charts.
  function closeDetail() {
    setDetail(null);
    setSeriesVersion((v) => v + 1);
  }

  function handleDetailDeleted() {
    if (detail?.endpoint === "/api/v1/goals") {
      const goalId = detail.id;
      setGoals((prev) => prev?.filter((goal) => goal.id !== goalId) ?? prev);
      setSelected((prev) => {
        const next = new Map(prev);
        next.delete(goalId);
        return next;
      });
    }
    closeDetail();
  }

  const slotOf = (goalId: string) => selected.get(goalId) ?? 1;
  const atLimit = selected.size >= MAX_GOALS;

  return (
    <div className="row g-3 gn-dashboard">
      <style href="goalnexa-dashboard" precedence="default">
        {DASHBOARD_CSS}
      </style>
      <CheckInModal
        accessToken={accessToken}
        metric={checkInMetric}
        goalTitle={goals?.find((goal) => goal.id === checkInMetric?.goal)?.title}
        onClose={() => setCheckInFor(null)}
        onSaved={() => {
          setCheckInFor(null);
          setSeriesVersion((v) => v + 1);
        }}
      />
      <Drawer open={detail !== null} title={detail?.endpoint === "/api/v1/metrics" ? "Metric" : "Goal"} onClose={closeDetail}>
        {detail && (
          <CrudDetailScreen
            key={`${detail.endpoint}/${detail.id}`}
            baseUrl={detail.endpoint}
            accessToken={accessToken}
            id={detail.id}
            linkComponent={linkComponent}
            resourcePath={resourcePath}
            onDeleted={handleDetailDeleted}
          />
        )}
      </Drawer>
      {error && (
        <div className="col-12">
          <div className="alert alert-danger mb-0">{error.message}</div>
        </div>
      )}

      <div className="col-12 col-lg-4">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardBody>
            <div className="mb-3">
              <FormLabel htmlFor="dashboard-org">Organization</FormLabel>
              <select
                id="dashboard-org"
                className="form-select form-select-sm"
                value={orgKey ?? ""}
                disabled={orgs === null}
                onChange={(event) => {
                  setOrgKey(event.target.value);
                  storeOrg(event.target.value);
                }}
              >
                {orgs === null && <option value="">Loading…</option>}
                {orgs?.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name}
                  </option>
                ))}
                <option value={PERSONAL}>Personal (no organization)</option>
              </select>
            </div>

            <div className="d-flex align-items-center justify-content-between mb-2">
              <FormLabel className="mb-0">
                Goals{" "}
                <span className="text-secondary fw-normal">
                  {selected.size}/{Math.min(MAX_GOALS, goals?.length ?? 0)}
                </span>
              </FormLabel>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-link btn-sm p-0" onClick={selectFirst} disabled={!goals?.length}>
                  {goals && goals.length > MAX_GOALS ? `Show first ${MAX_GOALS}` : "Show all"}
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => setSelected(new Map())}
                  disabled={selected.size === 0}
                >
                  Hide all
                </button>
              </div>
            </div>
            {goals === null ? (
              <div className="text-secondary small">Loading goals…</div>
            ) : goals.length === 0 ? (
              <div className="text-secondary small">No goals in this organization yet.</div>
            ) : (
              <GoalFilterList
                goals={goals}
                selected={selected}
                atLimit={atLimit}
                maxGoals={MAX_GOALS}
                onToggleGoal={toggleGoal}
                metricsByGoal={metricsByGoal}
                metricSlot={metricSlot}
                disabledMetrics={disabledMetrics}
                onToggleMetric={toggleMetric}
                currentByGoal={currentByGoal}
                loading={loadingSeries}
                onCheckIn={setCheckInFor}
                onOpenGoal={(id) => setDetail({ endpoint: "/api/v1/goals", id })}
                onOpenMetric={(id) => setDetail({ endpoint: "/api/v1/metrics", id })}
              />
            )}
            {atLimit && goals && goals.length > MAX_GOALS && (
              <div className="text-secondary small mt-2">Up to {MAX_GOALS} goals at a time.</div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="col-12 col-lg-8">
        {selected.size === 0 ? (
          <Card>
            <CardBody>
              <div className="text-secondary text-center py-5">Show one or more goals (the eye icon) to chart their progress.</div>
            </CardBody>
          </Card>
        ) : (
          <div className="d-flex flex-column gap-3">
            {/* Progress over time: one card per shown goal, one line per
                shown metric. All cards share one time range + % scale
                (panelDomain) so they compare at a glance. */}
            {loadingSeries ? (
              <Card>
                <CardBody>
                  <div className="text-secondary py-4 text-center">Loading…</div>
                </CardBody>
              </Card>
            ) : (
              metricPanels.map(({ progress: p, series, overflow }) => (
                <Card key={p.goal.id}>
                  <CardHeader>
                    <CardTitle>
                      <span className="d-inline-flex align-items-center gap-2">
                        {p.goal.title}
                        {p.current !== null && <span className="gn-goal-pct">{formatPct(p.current)}</span>}
                      </span>
                    </CardTitle>
                    <span className="card-subtitle ms-auto text-secondary small d-none d-md-inline">
                      Progress over time · each metric as % of its target
                    </span>
                  </CardHeader>
                  <CardBody>
                    {series.length === 0 ? (
                      <p className="text-secondary small mb-0">
                        {(metricsByGoal.get(p.goal.id)?.length ?? 0) === 0 ? "No metrics yet." : "All metrics hidden."}
                      </p>
                    ) : (
                      <ProgressLineChart
                        series={series}
                        height={220}
                        domain={panelDomain}
                        alwaysLegend
                        emptyText="No check-ins yet."
                        ariaLabel={`${p.goal.title}: metric progress over time`}
                      />
                    )}
                    {overflow > 0 && (
                      <p className="text-secondary small mb-0 mt-1">
                        +{overflow} more metric{overflow === 1 ? "" : "s"} not charted (max {MAX_GOALS} lines per goal).
                      </p>
                    )}
                  </CardBody>
                </Card>
              ))
            )}
            <Card>
              <CardHeader>
                <CardTitle>Current progress</CardTitle>
              </CardHeader>
              <CardBody>
                {loadingSeries ? (
                  <div className="text-secondary py-4 text-center">Loading…</div>
                ) : (
                  <ProgressBarChart rows={progress.map((p) => ({ progress: p, slot: slotOf(p.goal.id) }))} />
                )}
              </CardBody>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default DashboardScreen;
