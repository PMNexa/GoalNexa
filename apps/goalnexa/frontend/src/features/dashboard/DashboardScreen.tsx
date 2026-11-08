import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, FormLabel, FormSelect, Icon, useT, type LinkComponent } from "platform-core";
import messages from "./messages";
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import {
  fetchCheckIns,
  fetchGoal,
  fetchGoals,
  fetchMetrics,
  fetchOrgs,
  fetchTeams,
  teamSubtree,
  type OrgOption,
  type TeamOption,
} from "../../api/dashboard";
import type { CheckIn } from "../../api/checkIns";
import { fetchCycles, type Cycle } from "../../api/cycles";
import type { Snap } from "../../lib/periods";
import CheckInModal from "../../components/CheckInModal";
import CreateRecordModal, { type CreateTarget } from "../../components/CreateRecordModal";
import DashboardCharts from "./DashboardCharts";
import GoalFilterList, { withDescendants } from "../../components/GoalFilterList";
import ShareDashboardModal from "./ShareDashboardModal";
import { MAX_GOALS, useDashboardCharts } from "./useDashboardCharts";
import { DASHBOARD_CSS } from "../../components/dashboardStyles";
import OnboardingWizard from "../onboarding/OnboardingWizard";
import OrgWaiting from "../onboarding/OrgWaiting";
import PendingInvitations from "../onboarding/PendingInvitations";
import TimeZoneNotice from "../../components/TimeZoneNotice";
import onboardingMessages from "../onboarding/messages";
import { fetchReceivedInvitations, type ReceivedInvitation } from "../../api/invitations";
import { readStored, writeStored } from "../../lib/storedState";
import { applyOrder, byPosition, goalGroup, metricGroup, moveId, saveOrder, type OrderKind } from "../../lib/ordering";
import { getCurrentOrg, PERSONAL_ORG, setCurrentOrg, subscribeCurrentOrg } from "../../lib/currentOrg";
import DashboardDetailDrawer from "./DashboardDetailDrawer";
import DashboardViewFilters from "./DashboardViewFilters";
import {
  ALL_CYCLES,
  currentCycle,
  freeSlot,
  goalFromUrl,
  HIDDEN_METRICS_KEY,
  NO_CYCLE,
  onboardingSkipped,
  readShown,
  shownKey,
  skipOnboarding,
  SNAP_KEY,
  toError,
  writeShown,
  type DetailTarget,
} from "./dashboardState";

export interface DashboardScreenProps {
  accessToken: string;
  /** For links inside the details drawer (Edit, related rows) - same as `CrudDetailScreen`'s. */
  linkComponent?: LinkComponent;
  /** Where each resource's pages are mounted - same as `CrudDetailScreen`'s. */
  resourcePath?: (endpoint: string) => string | null;
  /** The full URL a public link's token opens (the host mounts that page); without it there's no "Share". */
  shareUrl?: (token: string) => string;
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
// Org roles that set up an organization's goals (platform-org's `my_role`).
const MANAGER_ROLES = new Set(["owner", "admin"]);

function DashboardScreen({ accessToken, linkComponent, resourcePath, shareUrl }: DashboardScreenProps) {
  const t = useT(messages);
  const tOnboarding = useT(onboardingMessages);
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [orgKey, setOrgKey] = useState<string | null>(null);
  const [goals, setGoals] = useState<Goal[] | null>(null);
  // Bumped when an org's goals (re)load - resets the selection (below).
  const [goalsLoaded, setGoalsLoaded] = useState(0);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleKey, setCycleKey] = useState<string>(ALL_CYCLES);
  // The team filter: "" = every goal, else a team id (it and the teams under it).
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamKey, setTeamKey] = useState("");
  const teamNames = useMemo(() => new Map(teams.map((team) => [team.id, team.name])), [teams]);
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
  // Open invitations to the user's email: shown before onboarding (so an
  // invited person joins instead of creating an org) and above the dashboard.
  const [invitations, setInvitations] = useState<ReceivedInvitation[]>([]);
  // A new user with invitations who chose "Set up my own instead".
  const [ownInstead, setOwnInstead] = useState(false);
  // Empty orgs a plain member chose to set up anyway (until reload).
  const [setupAnyway, setSetupAnyway] = useState<Set<string>>(() => new Set());
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
    Promise.all([
      fetchOrgs(accessToken),
      focusId ? fetchGoal(accessToken, focusId) : null,
      fetchReceivedInvitations(accessToken),
    ])
      .then(async ([items, focusGoal, received]) => {
        // No organization doesn't mean new: someone who started by chat
        // has personal goals already, and gets the dashboard, not the wizard.
        const isNew =
          items.length === 0 && !focusGoal && !onboardingSkipped() && (await fetchGoals(accessToken, null)).length === 0;
        if (cancelled) return;
        setOrgs(items);
        setInvitations(received);
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
    Promise.all([fetchGoals(accessToken, org), fetchCycles(accessToken, org), org ? fetchTeams(accessToken, org) : []])
      .then(([items, orgCycles, orgTeams]) => {
        if (cancelled) return;
        setGoals(items);
        setCycles(orgCycles);
        setTeams(orgTeams);
        setTeamKey((key) => (orgTeams.some((team) => team.id === key) ? key : ""));
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

  // The goals the cycle and team filters let through, minus archived ones - what the tree lists.
  const shownGoals = useMemo(() => {
    const inTeams = teamKey ? teamSubtree(teams, teamKey) : null;
    return (goals ?? []).filter(
      (goal) =>
        goal.status !== "archived" &&
        (cycleKey === ALL_CYCLES ? true : cycleKey === NO_CYCLE ? goal.cycle === null : goal.cycle === cycleKey) &&
        (inTeams === null || (goal.team_id != null && inTeams.has(goal.team_id))),
    );
  }, [goals, cycleKey, teamKey, teams]);

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
    const remembered = readShown(shownKey(orgKey, cycleKey, teamKey));
    if (remembered) {
      setSelected(new Map([...remembered].filter(([id]) => shownGoals.some((goal) => goal.id === id))));
      return;
    }
    setSelected(new Map(shownGoals.slice(0, MAX_GOALS).map((goal, i) => [goal.id, i + 1])));
    // Not on every `shownGoals` change: creating a goal mustn't reset the selection.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalsLoaded, cycleKey, teamKey]);

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

  const [snap, setSnap] = useState<Snap | null>(() => readStored<Snap | null>(SNAP_KEY, null));
  const charts = useDashboardCharts(goals, selected, metrics, checkIns, disabledMetrics, snap);
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
      writeShown(shownKey(orgKey, cycleKey, teamKey), next);
      return next;
    });
  }

  function toggleGoal(goalId: string) {
    chooseShown((prev) => {
      const next = new Map(prev);
      if (next.has(goalId)) for (const id of withDescendants(goals ?? [], goalId)) next.delete(id);
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

  // Drag and drop in the tree, within a sibling group: shown at once, then
  // saved; a failed save reloads the order from the server.
  function moveRow(kind: OrderKind, dragged: string, target: string, after: boolean) {
    let ids: string[];
    if (kind === "goal") {
      const goal = goals?.find((g) => g.id === dragged);
      if (!goals || !goal) return;
      const siblings = goals.filter((g) => goalGroup(g) === goalGroup(goal)).sort(byPosition((g) => g.title));
      ids = moveId(siblings.map((g) => g.id), dragged, target, after);
      setGoals(applyOrder(goals, ids, (g) => g.title));
    } else {
      const metric = metrics.find((m) => m.id === dragged);
      if (!metric) return;
      const siblings = metrics.filter((m) => metricGroup(m) === metricGroup(metric)).sort(byPosition((m) => m.name));
      ids = moveId(siblings.map((m) => m.id), dragged, target, after);
      setMetrics(applyOrder(metrics, ids, (m) => m.name));
    }
    saveOrder(accessToken, kind, ids).catch((thrown: unknown) => {
      setError(toError(thrown));
      if (kind === "metric") setSeriesVersion((v) => v + 1);
      else
        fetchGoals(accessToken, orgKey === PERSONAL_ORG ? null : orgKey)
          .then(setGoals)
          .catch(() => {});
    });
  }

  function addGoal(parentGoalId: string | null) {
    setCreateTarget({
      endpoint: "/api/v1/goals",
      title: parentGoalId ? t("newSubGoal", { title: titleOf("/api/v1/goals", parentGoalId) }) : t("newGoal"),
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
        ? t("newSubMetric", { title: titleOf("/api/v1/metrics", parentMetricId) })
        : t("newMetric", { title: titleOf("/api/v1/goals", goalId) }),
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

  const orgSelect = (id: string, size: "sm" | "md" = "sm", className?: string, ariaLabel?: string) => (
    <FormSelect
      id={id}
      aria-label={ariaLabel}
      size={size}
      className={className}
      value={orgKey ?? ""}
      disabled={orgs === null}
      onChange={(event) => {
        setOrgKey(event.target.value);
        setCurrentOrg(event.target.value);
      }}
    >
      {orgs === null && <option value="">{t("loading")}</option>}
      {orgs?.map((org) => (
        <option key={org.id} value={org.id}>
          {org.name}
        </option>
      ))}
      <option value={PERSONAL_ORG}>{t("personalOrg")}</option>
    </FormSelect>
  );

  // A chosen organization with no goals (archived ones don't count) gets the setup wizard, not an empty dashboard.
  const hasActiveGoals = (goals ?? []).some((goal) => goal.status !== "archived");
  const emptyOrg =
    orgKey !== null && orgKey !== PERSONAL_ORG && goals !== null && !hasActiveGoals && !setupSkipped.has(orgKey)
      ? orgs?.find((org) => org.id === orgKey)
      : undefined;
  const invitationList = invitations.length > 0 && (
    <PendingInvitations
      accessToken={accessToken}
      invitations={invitations}
      onAccepted={(org) => {
        // The org list reload picks the stored org, so the joined one opens.
        setCurrentOrg(org.id);
        setOnboarding(false);
        setOrgsVersion((v) => v + 1);
      }}
      onDeclined={(declined) => setInvitations((prev) => prev.filter((item) => item.token !== declined.token))}
    />
  );

  // Invited before they've set anything up: joining comes first, not the wizard.
  if (onboarding && invitationList && !ownInstead) {
    return (
      <div className="row justify-content-center">
        <div className="col-12 col-lg-9 col-xl-8">
          <div className="text-center mb-4">
            <h2 className="mb-1">{tOnboarding("invitedTitle")}</h2>
            <p className="text-secondary mb-0">{tOnboarding("invitedLead")}</p>
          </div>
          <Card>
            <CardBody>
              {invitationList}
              <Button variant="link" className="px-0 mt-3 text-secondary" onClick={() => setOwnInstead(true)}>
                {tOnboarding("ownInstead")}
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>
    );
  }

  // A plain member isn't the one to set up the org's goals - its owners and admins are.
  if (emptyOrg && !MANAGER_ROLES.has(emptyOrg.my_role ?? "") && !setupAnyway.has(emptyOrg.id)) {
    return (
      <>
        {invitationList && <div className="mb-3">{invitationList}</div>}
        <OrgWaiting
          orgName={emptyOrg.name}
          orgPicker={orgSelect("waiting-org", "md", "w-auto fw-semibold", t("organization"))}
          onPersonal={() => {
            setOrgKey(PERSONAL_ORG);
            setCurrentOrg(PERSONAL_ORG);
          }}
          onSetUpAnyway={() => setSetupAnyway((prev) => new Set(prev).add(emptyOrg.id))}
        />
      </>
    );
  }

  if (emptyOrg) {
    return (
      <>
        {invitationList && <div className="mb-3">{invitationList}</div>}
        <OnboardingWizard
          key={emptyOrg.id}
          accessToken={accessToken}
          existingOrg={{ id: emptyOrg.id, name: emptyOrg.name }}
          orgPicker={orgSelect("setup-org", "md", "w-auto fw-semibold", t("organization"))}
          onComplete={() => setGoalsVersion((v) => v + 1)}
          onSkip={() => setSetupSkipped((prev) => new Set(prev).add(emptyOrg.id))}
        />
      </>
    );
  }

  if (onboarding) {
    return (
      <OnboardingWizard
        accessToken={accessToken}
        onComplete={(orgId) => {
          // The org list reload picks the stored org, so the new one (or personal goals) opens.
          setCurrentOrg(orgId ?? PERSONAL_ORG);
          // Personal goals may already be the picked view - reload them too.
          setGoalsVersion((v) => v + 1);
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
            orgKey === PERSONAL_ORG ? t("personalGoals") : orgs?.find((org) => org.id === orgKey)?.name,
            cycles.find((cycle) => cycle.id === cycleKey)?.name,
          ]
            .filter(Boolean)
            .join(" · ")}
          onClose={() => setSharing(false)}
        />
      )}
      <DashboardDetailDrawer
        accessToken={accessToken}
        detail={detail}
        detailVersion={detailVersion}
        linkComponent={linkComponent}
        resourcePath={resourcePath}
        onClose={closeDetail}
        onDeleted={handleDetailDeleted}
        onChanged={() => setDetailVersion((v) => v + 1)}
      />
      {invitationList && <div className="col-12">{invitationList}</div>}
      <TimeZoneNotice className="col-12" accessToken={accessToken} onChanged={() => setGoalsVersion((v) => v + 1)} />
      {error && (
        <div className="col-12">
          <div className="alert alert-danger mb-0">{error.message}</div>
        </div>
      )}

      <div className="col-12 col-lg-4 gn-pane">
        <Card>
          <CardHeader>
            <CardTitle>{t("filters")}</CardTitle>
            {shareUrl && (
              <Button
                variant="secondary"
                outline
                className="ms-auto"
                onClick={() => setSharing(true)}
                title={t("shareHint")}
              >
                <Icon name="link" />
                {t("share")}
              </Button>
            )}
          </CardHeader>
          <CardBody>
            <DashboardViewFilters
              cycles={cycles}
              cycleKey={cycleKey}
              onCycle={setCycleKey}
              snap={snap}
              onSnap={(next) => {
                setSnap(next);
                writeStored(SNAP_KEY, next);
              }}
              teams={teams}
              teamKey={teamKey}
              onTeam={setTeamKey}
            />

            <div className="d-flex align-items-center justify-content-between mb-2">
              <FormLabel className="mb-0">
                {t("goals")}{" "}
                <span className="text-secondary fw-normal">
                  {selected.size}/{Math.min(MAX_GOALS, shownGoals.length)}
                </span>
              </FormLabel>
              <div className="d-flex gap-2">
                <button type="button" className="btn btn-link btn-sm p-0" onClick={() => addGoal(null)} disabled={orgKey === null}>
                  {t("newGoal")}
                </button>
                <button type="button" className="btn btn-link btn-sm p-0" onClick={selectFirst} disabled={!shownGoals.length}>
                  {shownGoals.length > MAX_GOALS ? t("showFirst", { n: MAX_GOALS }) : t("showAll")}
                </button>
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0"
                  onClick={() => chooseShown(() => new Map())}
                  disabled={selected.size === 0}
                >
                  {t("hideAll")}
                </button>
              </div>
            </div>
            {goals === null ? (
              <div className="text-secondary small">{t("loadingGoals")}</div>
            ) : shownGoals.length === 0 ? (
              <div className="text-secondary small">
                {!hasActiveGoals
                  ? t("noGoalsInOrg")
                  : teamKey
                    ? t("noGoalsForTeam")
                    : t("noGoalsInCycle")}
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
                  onMove: moveRow,
                }}
                now={now}
                teamNames={teamNames}
              />
            )}
            {atLimit && shownGoals.length > MAX_GOALS && (
              <div className="text-secondary small mt-2">{t("upToGoals", { n: MAX_GOALS })}</div>
            )}
          </CardBody>
        </Card>
      </div>

      <div className="col-12 col-lg-8 gn-pane">
        {selected.size === 0 ? (
          <Card>
            <CardBody>
              <div className="text-secondary text-center py-5">{t("showToChart")}</div>
            </CardBody>
          </Card>
        ) : (
          <DashboardCharts charts={charts} slotOf={slotOf} loading={loadingSeries} teamNames={teamNames} />
        )}
      </div>
    </div>
  );
}

export default DashboardScreen;
