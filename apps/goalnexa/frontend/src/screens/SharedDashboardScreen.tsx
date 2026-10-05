import { useEffect, useMemo, useState } from "react";
import { Card, CardBody } from "platform-core";
import type { CheckIn } from "../lib/api/checkIns";
import type { Goal } from "../lib/api/goals";
import type { Metric } from "../lib/api/metrics";
import { fetchSharedDashboard, type SharedDashboard } from "../lib/api/shares";
import DashboardCharts from "./dashboard/DashboardCharts";
import { useDashboardCharts } from "./dashboard/useDashboardCharts";
import { DASHBOARD_CSS } from "./dashboard/dashboardStyles";

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
 * login, nothing to click into. Live: progress as it is when opened.
 */
function SharedDashboardScreen({ token }: SharedDashboardScreenProps) {
  const [data, setData] = useState<SharedDashboard | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchSharedDashboard(token)
      .then((result) => !cancelled && setData(result))
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
  const hidden = useMemo(() => new Set(data?.hidden_metrics ?? []), [data]);
  const charts = useDashboardCharts(goals, slots, metrics, checkIns, hidden);

  const message = error
    ? error
    : data === null
      ? "This link was removed, or it never existed."
      : data && goals.length === 0
        ? "Nothing to show here anymore."
        : null;

  return (
    <div className="container-xl py-4 gn-dashboard">
      <style href="goalnexa-dashboard" precedence="default">
        {DASHBOARD_CSS}
      </style>
      <div className="mb-3">
        <h2 className="page-title">{data?.title || "Shared goals"}</h2>
        <div className="text-secondary small">Read-only · shared from GoalNexa</div>
      </div>
      {data === undefined && !error ? (
        <Card>
          <CardBody>
            <div className="text-secondary py-4 text-center">Loading…</div>
          </CardBody>
        </Card>
      ) : message ? (
        <Card>
          <CardBody>
            <div className="text-secondary py-4 text-center">{message}</div>
          </CardBody>
        </Card>
      ) : (
        <DashboardCharts charts={charts} slotOf={(id) => slots.get(id) ?? 1} />
      )}
    </div>
  );
}

export default SharedDashboardScreen;
