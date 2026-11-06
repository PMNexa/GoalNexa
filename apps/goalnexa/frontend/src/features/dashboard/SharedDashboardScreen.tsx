import { useEffect, useMemo, useState } from "react";
import { Card, CardBody, CardHeader, CardTitle, useT } from "platform-core";
import type { CheckIn } from "../../api/checkIns";
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import { fetchSharedDashboard, type SharedDashboard } from "../../api/shares";
import DashboardCharts from "./DashboardCharts";
import GoalFilterList, { withDescendants } from "../../components/GoalFilterList";
import { MAX_GOALS, useDashboardCharts } from "./useDashboardCharts";
import { DASHBOARD_CSS } from "../../components/dashboardStyles";
import messages from "./messages";

export interface SharedDashboardScreenProps {
  /** The secret from the link. */
  token: string;
}

// The link carries only what the charts read; the rest of each row is
// filled with neutral values so the shared chart code takes them as is.
function asGoal(goal: SharedDashboard["goals"][number]): Goal {
  return { ...goal, description: "", owner_id: "", org_id: null, visibility: "public", cycle: null };
}

function asMetric(metric: SharedDashboard["metrics"][number]): Metric {
  return {
    ...metric,
    description: "",
    check_in_every: "",
    last_checked_in_at: null,
    check_in_due_at: null,
    ingest_token_hint: "",
  };
}

function asCheckIn(checkIn: SharedDashboard["check_ins"][number]): CheckIn {
  return { ...checkIn, note: "", author_id: null };
}

/**
 * What a public dashboard link shows (`DashboardShare`): the same charts
 * as the dashboard, read-only, for the goals the link was made with - no
 * login, nothing to edit. The goal tree is there too, without its menus:
 * its eyes show/hide goals and metrics for this visit only (the link keeps
 * what it was made with). Live: progress as it is when opened.
 */
function SharedDashboardScreen({ token }: SharedDashboardScreenProps) {
  const t = useT(messages);
  const [data, setData] = useState<SharedDashboard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  // The visitor's own show/hide, starting from the link's.
  const [hiddenGoals, setHiddenGoals] = useState<Set<string>>(new Set());
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchSharedDashboard(token)
      .then((result) => {
        if (cancelled) return;
        setData(result);
        setHiddenGoals(new Set());
        setHidden(new Set(result?.hidden_metrics ?? []));
      })
      .catch((thrown: unknown) => !cancelled && setError(thrown instanceof Error ? thrown.message : String(thrown)));
    return () => {
      cancelled = true;
    };
  }, [token]);

  const goals = useMemo(() => data?.goals.map(asGoal) ?? [], [data]);
  const metrics = useMemo(() => data?.metrics.map(asMetric) ?? [], [data]);
  const checkIns = useMemo(() => data?.check_ins.map(asCheckIn) ?? [], [data]);
  // A goal's color is its place on the link - the order the dashboard had them in.
  const slots = useMemo(() => new Map(goals.map((goal, i) => [goal.id, i + 1])), [goals]);
  const selected = useMemo(
    () => new Map([...slots].filter(([id]) => !hiddenGoals.has(id))),
    [slots, hiddenGoals],
  );
  const charts = useDashboardCharts(goals, selected, metrics, checkIns, hidden);
  const currentByGoal = useMemo(
    () => new Map(charts.progress.map((p) => [p.goal.id, p.current])),
    [charts.progress],
  );
  const toggle = (set: Set<string>, id: string) => {
    const next = new Set(set);
    if (!next.delete(id)) next.add(id);
    return next;
  };

  const message = error
    ? error
    : data === null
      ? t("linkRemoved")
      : data && goals.length === 0
        ? t("nothingToShow")
        : null;

  return (
    <div className="container-xl py-4 gn-dashboard">
      <style href="goalnexa-dashboard" precedence="default">
        {DASHBOARD_CSS}
      </style>
      <div className="mb-3">
        <h2 className="page-title">{data?.title || t("sharedTitle")}</h2>
        <div className="text-secondary small">{t("sharedSubtitle")}</div>
      </div>
      {data === undefined && !error ? (
        <Card>
          <CardBody>
            <div className="text-secondary py-4 text-center">{t("loading")}</div>
          </CardBody>
        </Card>
      ) : message ? (
        <Card>
          <CardBody>
            <div className="text-secondary py-4 text-center">{message}</div>
          </CardBody>
        </Card>
      ) : (
        <div className="row g-3">
          <div className="col-12 col-lg-4">
            <Card>
              <CardHeader>
                <CardTitle>{t("goals")}</CardTitle>
              </CardHeader>
              <CardBody>
                <GoalFilterList
                  goals={goals}
                  selected={selected}
                  atLimit={false}
                  maxGoals={MAX_GOALS}
                  onToggleGoal={(id) =>
                    setHiddenGoals((prev) =>
                      prev.has(id) ? toggle(prev, id) : new Set([...prev, ...withDescendants(goals, id)]),
                    )
                  }
                  metricsByGoal={charts.metricsByGoal}
                  metricSlot={charts.metricSlot}
                  disabledMetrics={hidden}
                  onToggleMetric={(id) => setHidden((prev) => toggle(prev, id))}
                  currentByGoal={currentByGoal}
                  loading={false}
                  now={charts.now}
                />
              </CardBody>
            </Card>
          </div>
          <div className="col-12 col-lg-8">
            {selected.size === 0 ? (
              <Card>
                <CardBody>
                  <div className="text-secondary text-center py-5">{t("showToChart")}</div>
                </CardBody>
              </Card>
            ) : (
              <DashboardCharts charts={charts} slotOf={(id) => slots.get(id) ?? 1} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default SharedDashboardScreen;
