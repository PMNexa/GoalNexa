import { useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  CrudDetailScreen,
  Drawer,
  FormLabel,
  Icon,
  type LinkComponent,
} from "platform-core";
import type { Goal } from "../lib/api/goals";
import GoalActivityPanel from "./GoalActivityPanel";
import GoalSharingPanel from "./GoalSharingPanel";
import MetricIngestPanel from "./MetricIngestPanel";
import type { Metric } from "../lib/api/metrics";
import {
  fetchCheckIns,
  fetchGoal,
  fetchGoals,
  fetchMetrics,
  fetchOrgs,
  type OrgOption,
} from "../lib/api/dashboard";
import type { CheckIn } from "../lib/api/checkIns";
import { fetchCycles, type Cycle } from "../lib/api/cycles";
import CheckInModal from "./dashboard/CheckInModal";
import CreateRecordModal, { type CreateTarget } from "./dashboard/CreateRecordModal";
import DashboardCharts from "./dashboard/DashboardCharts";
import GoalFilterList from "./dashboard/GoalFilterList";
import ShareDashboardModal from "./dashboard/ShareDashboardModal";
import { MAX_GOALS, useDashboardCharts } from "./dashboard/useDashboardCharts";
import { DASHBOARD_CSS } from "./dashboard/dashboardStyles";
import OnboardingWizard from "./onboarding/OnboardingWizard";
import { readStored, writeStored } from "../lib/storedState";
import { getCurrentOrg, PERSONAL_ORG, setCurrentOrg, subscribeCurrentOrg } from "../lib/currentOrg";

export interface DashboardScreenProps {
  accessToken: string;
  /** For links inside the details drawer (Edit, related rows) - same as `CrudDetailScreen`'s. */
  linkComponent?: LinkComponent;
  /** Where each resource's pages are mounted - same as `CrudDetailScreen`'s. */
  resourcePath?: (endpoint: string) => string | null;
  /** The full URL a public link's token opens (the host mounts that page); without it there's no "Share". */
  shareUrl?: (token: string) => string;
}

/** What the details drawer shows: a goal or a metric, by its API base URL. */
interface DetailTarget {
  endpoint: "/api/v1/goals" | "/api/v1/metrics";
  id: string;
}

/** The cycle filter: every goal, goals in no cycle, or one cycle's (its id). */
const ALL_CYCLES = "all";
const NO_CYCLE = "none";

/** The cycle running today, if any - what the dashboard opens on. */
function currentCycle(cycles: Cycle[]): Cycle | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return cycles.find((c) => c.status === "active" && c.starts_on <= today && today <= c.ends_on);
}

/** Set once a user without an org skips the onboarding wizard - not asked again in this browser. */
const ONBOARDING_SKIPPED_KEY = "goalnexa:onboarding-skipped";

function onboardingSkipped(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_SKIPPED_KEY) !== null;
  } catch {
    return false;
  }
}

function skipOnboarding() {
  try {
    window.localStorage.setItem(ONBOARDING_SKIPPED_KEY, "1");
  } catch {
    // Asked again next time - harmless.
  }
}

function toError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

/**
 * `?goal=<id>` - the link an AI agent's reply (or a reminder) ends with:
 * the dashboard opens on that goal's organization, showing just it. Read
 * from `window.location` (no router in this package), once per page load.
 */
function goalFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("goal");
  } catch {
    return null;
  }
}

const HIDDEN_METRICS_KEY = "goalnexa:dashboard-hidden-metrics";
const SHOWN_GOALS_KEY = "goalnexa:dashboard-shown-goals";

/** The shown goals (id -> color slot) remembered for an org + cycle, or null if never chosen. */
function readShown(scope: string): Map<string, number> | null {
  const stored = readStored<Record<string, [string, number][]>>(SHOWN_GOALS_KEY, {})[scope];
  return Array.isArray(stored) ? new Map(stored) : null;
}

function writeShown(scope: string, shown: Map<string, number>) {
  writeStored(SHOWN_GOALS_KEY, { ...readStored<Record<string, unknown>>(SHOWN_GOALS_KEY, {}), [scope]: [...shown] });
}

/** Lowest color slot (1-8) not already held by a selected goal. */
function freeSlot(slots: Map<string, number>): number {
  const taken = new Set(slots.values());
  for (let slot = 1; slot <= MAX_GOALS; slot += 1) if (!taken.has(slot)) return slot;
  return MAX_GOALS;
}

/**
 * Goal dashboard: pick ONE org (or personal goals) - and optionally one of
 * its cycles (opens on the one running today) - pick up to 8 of its
 * goals, see their progress over time + where each stands now. Each
 * selected goal lists its metrics: unticking one leaves it out of that
 * goal's progress (both charts), and "Check in" logs a reading
 * inline - the charts refresh in place. "New goal" and each row's "+"
 * menu create goals, sub-goals, metrics and sub-metrics where they hang
 * in the tree (`CreateRecordModal`). A goal's or metric's name opens
 * platform-core's `CrudDetailScreen` in a right-hand drawer. Progress
 * math lives in `lib/progress.ts` - including each panel's health badge
 * (on track / at risk / off track / achieved, from its projection) and the
 * tree's "check-in due" clocks; charts are plain SVG
 * (`dashboard/`), no chart library. A user with no organization and no goals gets the
 * onboarding wizard (`onboarding/`) instead, until they finish or skip it. Self-contained like every screen in
 * this package - `accessToken` in, no router dependency.
 */
function DashboardScreen({ accessToken, linkComponent, resourcePath, shareUrl }: DashboardScreenProps) {
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [orgKey, setOrgKey] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  // Bumped when an org's goals (re)load - resets the selection (below).
  const [goalsLoaded, setGoalsLoaded] = useState(0);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleKey, setCycleKey] = useState<string>(ALL_CYCLES);
  // goal id -> color slot, in selection order. A goal keeps its slot for
  // as long as it's selected, so (de)selecting others never repaints it.
  const [selected, setSelected] = useState<Map<string, number>>(new Map());
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [checkIns, setCheckIns] = useState<CheckIn[]>([]);
  const [loadingSeries, setLoadingSeries] = useState(false);
  // Opt-out, not opt-in: every metric counts until unticked, so a goal's
  // progress matches the rest of the app by default.
  const [disabledMetrics, setDisabledMetrics] = useState<Set<string>>(() => new Set(readStored<string[]>(HIDDEN_METRICS_KEY, [])));
  const [checkInFor, setCheckInFor] = useState<string | null>(null);
  const [createTarget, setCreateTarget] = useState<CreateTarget | null>(null);
  const [sharing, setSharing] = useState(false);
  // Bumped after an inline check-in - refetches metrics/check-ins without
  // flashing the charts back to "Loading…" (see the effect below).
  const [seriesVersion, setSeriesVersion] = useState(0);
  const loadedKeyRef = useRef<string | null>(null);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  // Bumped when the drawer's sharing panel changes the goal - reloads its details.
  const [detailVersion, setDetailVersion] = useState(0);
  const [error, setError] = useState<Error | null>(null);
  const [onboarding, setOnboarding] = useState(false);
  // Organizations whose empty-state setup wizard was skipped (until reload).
  const [setupSkipped, setSetupSkipped] = useState<Set<string>>(() => new Set());
  // Bumped after the wizard adds goals to an org that already exists - reloads its goals.
  const [goalsVersion, setGoalsVersion] = useState(0);
  // Bumped after onboarding creates an org - reloads the org list.
  const [orgsVersion, setOrgsVersion] = useState(0);
  // The goal a `?goal=` link asked for, until it has been shown (or isn't found).
  const focusGoalRef = useRef<string | null | undefined>(undefined);
  if (focusGoalRef.current === undefined) focusGoalRef.current = typeof window === "undefined" ? null : goalFromUrl();

  useEffect(() => {
    let cancelled = false;
    const focusId = focusGoalRef.current;
    Promise.all([fetchOrgs(accessToken), focusId ? fetchGoal(accessToken, focusId) : null])
      .then(async ([items, focusGoal]) => {
        // No organization doesn't mean new: someone who started by chat
        // has personal goals already, and gets the dashboard, not the wizard.
        const isNew =
          items.length === 0 && !focusGoal && !onboardingSkipped() && (await fetchGoals(accessToken, null)).length === 0;
        if (cancelled) return;
        setOrgs(items);
        setOnboarding(isNew);
        if (focusGoal) {
          // A linked goal picks its own organization.
          setOrgKey(focusGoal.org_id ?? PERSONAL_ORG);
          return;
        }
        focusGoalRef.current = null;
        // The last pick, if it's still one of this user's orgs.
        const stored = getCurrentOrg();
        const valid = stored === PERSONAL_ORG || items.some((org) => org.id === stored);
        setOrgKey(valid && stored ? stored : (items[0]?.id ?? PERSONAL_ORG));
      })
      .catch((thrown: unknown) => !cancelled && setError(toError(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, orgsVersion]);

  // A switch from outside (the host's header menu, another tab) - follow
  // it if it's one of this user's orgs.
  useEffect(() => {
    if (orgs === null) return;
    return subscribeCurrentOrg(() => {
      const next = getCurrentOrg();
      if (next === PERSONAL_ORG || orgs.some((org) => org.id === next)) setOrgKey(next);
    });
  }, [orgs]);

  useEffect(() => {
    if (orgKey === null) return;
    let cancelled = false;
    setGoals(null);
    setSelected(new Map());
    const org = orgKey === PERSONAL_ORG ? null : orgKey;
    Promise.all([fetchGoals(accessToken, org), fetchCycles(accessToken, org)])
      .then(([items, orgCycles]) => {
        if (cancelled) return;
        setGoals(items);
        setCycles(orgCycles);
        // Open on the cycle running today, if there is one - unless a
        // linked goal isn't in it.
        const focus = items.find((goal) => goal.id === focusGoalRef.current);
        const running = currentCycle(orgCycles)?.id;
        setCycleKey(focus && focus.cycle !== (running ?? null) ? ALL_CYCLES : (running ?? ALL_CYCLES));
        setGoalsLoaded((n) => n + 1);
      })
      .catch((thrown: unknown) => !cancelled && setError(toError(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, orgKey, goalsVersion]);

  // The goals the cycle filter lets through, minus archived ones - what the tree lists.
  const shownGoals = useMemo(
    () =>
      (goals ?? []).filter(
        (goal) =>
          goal.status !== "archived" &&
          (cycleKey === ALL_CYCLES ? true : cycleKey === NO_CYCLE ? goal.cycle === null : goal.cycle === cycleKey),
      ),
    [goals, cycleKey],
  );

  // A new org or cycle starts with its first few goals selected, so the page opens on a chart.
  useEffect(() => {
    const focusId = focusGoalRef.current;
    if (focusId && goals !== null) {
      focusGoalRef.current = null;
      if (shownGoals.some((goal) => goal.id === focusId)) {
        setSelected(new Map([[focusId, 1]]));
        return;
      }
    }
    const remembered = readShown(`${orgKey}|${cycleKey}`);
    if (remembered) {
      setSelected(new Map([...remembered].filter(([id]) => shownGoals.some((goal) => goal.id === id))));
      return;
    }
    setSelected(new Map(shownGoals.slice(0, MAX_GOALS).map((goal, i) => [goal.id, i + 1])));
    // Not on every `shownGoals` change: creating a goal mustn't reset the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalsLoaded, cycleKey]);

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

  const charts = useDashboardCharts(goals, selected, metrics, checkIns, disabledMetrics);
  const { progress, metricsByGoal, metricSlot, now } = charts;

  const checkInMetric = metrics.find((metric) => metric.id === checkInFor) ?? null;
  const currentByGoal = useMemo(() => new Map(progress.map((p) => [p.goal.id, p.current])), [progress]);

  function toggleMetric(metricId: string) {
    setDisabledMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(metricId)) next.delete(metricId);
      else next.add(metricId);
      writeStored(HIDDEN_METRICS_KEY, [...next]);
      return next;
    });
  }

  // Every change the user makes to what's shown is remembered per org + cycle.
  function chooseShown(update: (prev: Map<string, number>) => Map<string, number>) {
    setSelected((prev) => {
      const next = update(prev);
      writeShown(`${orgKey}|${cycleKey}`, next);
      return next;
    });
  }

  function toggleGoal(goalId: string) {
    chooseShown((prev) => {
      const next = new Map(prev);
      if (next.has(goalId)) next.delete(goalId);
      else if (next.size < MAX_GOALS) next.set(goalId, freeSlot(next));
      return next;
    });
  }

  function selectFirst() {
    chooseShown(() => new Map(shownGoals.slice(0, MAX_GOALS).map((goal, i) => [goal.id, i + 1])));
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

  const orgId = orgKey === PERSONAL_ORG ? null : orgKey;
  const titleOf = (endpoint: "/api/v1/goals" | "/api/v1/metrics", id: string) =>
    endpoint === "/api/v1/goals" ? goals?.find((goal) => goal.id === id)?.title : metrics.find((metric) => metric.id === id)?.name;

  function addGoal(parentGoalId: string | null) {
    setCreateTarget({
      endpoint: "/api/v1/goals",
      title: parentGoalId ? `New sub-goal of ${titleOf("/api/v1/goals", parentGoalId)}` : "New goal",
      preset: {
        org_id: orgId,
        ...(parentGoalId ? { parent: parentGoalId } : {}),
        ...(cycleKey !== ALL_CYCLES && cycleKey !== NO_CYCLE ? { cycle: cycleKey } : {}),
      },
    });
  }

  function addMetric(goalId: string, parentMetricId: string | null) {
    setCreateTarget({
      endpoint: "/api/v1/metrics",
      title: parentMetricId
        ? `New sub-metric of ${titleOf("/api/v1/metrics", parentMetricId)}`
        : `New metric for ${titleOf("/api/v1/goals", goalId)}`,
      preset: { goal: goalId, ...(parentMetricId ? { parent: parentMetricId } : {}) },
    });
  }

  // A new goal joins the tree (shown, if there's a free slot); a new
  // metric shows its goal, so it lands somewhere visible.
  function handleCreated(row: Record<string, unknown>) {
    const goalId = String(createTarget?.endpoint === "/api/v1/goals" ? row.id : row.goal);
    if (createTarget?.endpoint === "/api/v1/goals") setGoals((prev) => [...(prev ?? []), row as unknown as Goal]);
    setSelected((prev) => {
      if (prev.has(goalId) || prev.size >= MAX_GOALS) return prev;
      return new Map(prev).set(goalId, freeSlot(prev));
    });
    setSeriesVersion((v) => v + 1);
  }

  const slotOf = (goalId: string) => selected.get(goalId) ?? 1;
  const atLimit = selected.size >= MAX_GOALS;

  const orgSelect = (id: string, className = "form-select form-select-sm", ariaLabel?: string) => (
    <select
      id={id}
      aria-label={ariaLabel}
      className={className}
      value={orgKey ?? ""}
      disabled={orgs === null}
      onChange={(event) => {
        setOrgKey(event.target.value);
        setCurrentOrg(event.target.value);
      }}
    >
      {orgs === null && <option value="">Loading…</option>}
      {orgs?.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
      <option value={PERSONAL_ORG}>Personal (no organization)</option>
    </select>
  );

  // A chosen organization with no goals (archived ones don't count) gets the setup wizard, not an empty dashboard.
  const hasActiveGoals = (goals ?? []).some((goal) => goal.status !== "archived");
  const emptyOrg =
    orgKey !== null && orgKey !== PERSONAL_ORG && goals !== null && !hasActiveGoals && !setupSkipped.has(orgKey)
      ? orgs?.find((org) => org.id === orgKey)
      : undefined;
  if (emptyOrg) {
    return (
      <OnboardingWizard
        key={emptyOrg.id}
        accessToken={accessToken}
        existingOrg={{ id: emptyOrg.id, name: emptyOrg.name }}
        orgPicker={orgSelect("setup-org", "form-select w-auto fw-semibold", "Organization")}
        onComplete={() => setGoalsVersion((v) => v + 1)}
        onSkip={() => setSetupSkipped((prev) => new Set(prev).add(emptyOrg.id))}
      />
    );
  }

  if (onboarding) {
    return (
      <OnboardingWizard
        accessToken={accessToken}
        onComplete={(orgId) => {
          // The org list reload picks the stored org, so the new one opens.
          if (orgId) setCurrentOrg(orgId);
          setOnboarding(false);
          setOrgsVersion((v) => v + 1);
        }}
        onSkip={() => {
          skipOnboarding();
          setOnboarding(false);
        }}
      />
    );
  }

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
      <CreateRecordModal
        accessToken={accessToken}
        target={createTarget}
        onCreated={handleCreated}
        onClose={() => setCreateTarget(null)}
      />
      {shareUrl && (
        <ShareDashboardModal
          open={sharing}
          accessToken={accessToken}
          shareUrl={shareUrl}
          // In color-slot order, so the link's page paints each goal the same.
          goals={[...selected]
            .sort((a, b) => a[1] - b[1])
            .flatMap(([id]) => goals?.find((goal) => goal.id === id) ?? [])}
          hiddenMetrics={metrics.filter((metric) => disabledMetrics.has(metric.id)).map((metric) => metric.id)}
          defaultTitle={[
            orgKey === PERSONAL_ORG ? "Personal goals" : orgs?.find((org) => org.id === orgKey)?.name,
            cycles.find((cycle) => cycle.id === cycleKey)?.name,
          ]
            .filter(Boolean)
            .join(" · ")}
          onClose={() => setSharing(false)}
        />
      )}
      <Drawer open={detail !== null} title={detail?.endpoint === "/api/v1/metrics" ? "Metric" : "Goal"} onClose={closeDetail}>
        {detail && (
          <CrudDetailScreen
            key={`${detail.endpoint}/${detail.id}/${detailVersion}`}
            baseUrl={detail.endpoint}
            accessToken={accessToken}
            id={detail.id}
            linkComponent={linkComponent}
            resourcePath={resourcePath}
            onDeleted={handleDetailDeleted}
          />
        )}
        {detail?.endpoint === "/api/v1/goals" && (
          <GoalSharingPanel
            key={detail.id}
            accessToken={accessToken}
            goalId={detail.id}
            onChanged={() => setDetailVersion((v) => v + 1)}
            onLeft={handleDetailDeleted}
          />
        )}
        {detail?.endpoint === "/api/v1/goals" && (
          <GoalActivityPanel key={`${detail.id}/${detailVersion}`} accessToken={accessToken} goalId={detail.id} />
        )}
        {detail?.endpoint === "/api/v1/metrics" && (
          <MetricIngestPanel
            key={detail.id}
            accessToken={accessToken}
            metricId={detail.id}
            onChanged={() => setDetailVersion((v) => v + 1)}
          />
        )}
      </Drawer>
      {error && (
        <div className="col-12">
          <div className="alert alert-danger mb-0">{error.message}</div>
        </div>
      )}

      <div className="col-12 col-lg-4 gn-pane">
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
            {shareUrl && (
              <Button
                variant="secondary"
                outline
                className="ms-auto"
                onClick={() => setSharing(true)}
                title="A public, read-only link to the goals shown"
              >
                <Icon name="link" />
                Share
              </Button>
            )}
          </CardHeader>
          <CardBody>
            <div className="mb-3">
              <FormLabel htmlFor="dashboard-org">Organization</FormLabel>
              {orgSelect("dashboard-org")}
            </div>

            {cycles.length > 0 && (
              <div className="mb-3">
                <FormLabel htmlFor="dashboard-cycle">Cycle</FormLabel>
                <select
                  id="dashboard-cycle"
                  className="form-select form-select-sm"
                  value={cycleKey}
                  onChange={(event) => setCycleKey(event.target.value)}
                >
                  <option value={ALL_CYCLES}>All goals</option>
                  {cycles.map((cycle) => (
                    <option key={cycle.id} value={cycle.id}>
                      {cycle.name}
                      {cycle.status === "closed" ? " (closed)" : cycle.status === "planning" ? " (planning)" : ""}
                    </option>
                  ))}
                  <option value={NO_CYCLE}>Not in a cycle</option>
                </select>
              </div>
            )}

            <div className="d-flex align-items-center justify-content-between mb-2">
              <FormLabel className="mb-0">
                Goals{" "}
                <span className="text-secondary fw-normal">
                  {selected.size}/{Math.min(MAX_GOALS, shownGoals.length)}
                </span>
              </FormLabel>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => addGoal(null)} disabled={orgKey === null}>
                  New goal
                </button>
                <button type="button" className="btn btn-link btn-sm p-0" onClick={selectFirst} disabled={!shownGoals.length}>
                  {shownGoals.length > MAX_GOALS ? `Show first ${MAX_GOALS}` : "Show all"}
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => chooseShown(() => new Map())}
                  disabled={selected.size === 0}
                >
                  Hide all
                </button>
              </div>
            </div>
            {goals === null ? (
              <div className="text-secondary small">Loading goals…</div>
            ) : shownGoals.length === 0 ? (
              <div className="text-secondary small">
                {!hasActiveGoals ? "No goals in this organization yet." : "No goals in this cycle yet."}
              </div>
            ) : (
              <GoalFilterList
                goals={shownGoals}
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
                actions={{
                  onCheckIn: setCheckInFor,
                  onAddMetric: addMetric,
                  onAddGoal: addGoal,
                  onOpenGoal: (id) => setDetail({ endpoint: "/api/v1/goals", id }),
                  onOpenMetric: (id) => setDetail({ endpoint: "/api/v1/metrics", id }),
                }}
                now={now}
              />
            )}
            {atLimit && shownGoals.length > MAX_GOALS && (
              <div className="text-secondary small mt-2">Up to {MAX_GOALS} goals at a time.</div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="col-12 col-lg-8 gn-pane">
        {selected.size === 0 ? (
          <Card>
            <CardBody>
              <div className="text-secondary text-center py-5">Show one or more goals (the eye icon) to chart their progress.</div>
            </CardBody>
          </Card>
        ) : (
          <DashboardCharts charts={charts} slotOf={slotOf} loading={loadingSeries} />
        )}
      </div>
    </div>
  );
}

export default DashboardScreen;
