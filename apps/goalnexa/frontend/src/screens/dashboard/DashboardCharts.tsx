import { Card, CardBody, CardHeader, CardTitle } from "platform-core";
import type { Goal, GoalHealth } from "../../lib/api/goals";
import { goalHealth, goalTargetTime } from "../../lib/progress";
import ProgressBarChart from "./ProgressBarChart";
import ProgressLineChart, { type ChartMarker } from "./ProgressLineChart";
import { formatPct } from "./chartUtils";
import { MAX_GOALS, type DashboardChartsData } from "./useDashboardCharts";

const markerDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

const HEALTH_LABELS: Record<Exclude<GoalHealth, "unknown">, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  achieved: "Achieved",
};

/** Vertical lines on a goal's panel: now, and its target date if it has one. */
function goalMarkers(goal: Goal, now: number): ChartMarker[] {
  const target = goalTargetTime(goal);
  return [
    { t: now, label: "Now", kind: "now" },
    ...(target === null ? [] : [{ t: target, label: `Target ${markerDate.format(target)}`, kind: "target" as const }]),
  ];
}

export interface DashboardChartsProps {
  charts: DashboardChartsData;
  /** A goal's color slot (1-8) on the current-progress bars. */
  slotOf: (goalId: string) => number;
  loading?: boolean;
}

/**
 * The dashboard's right-hand column: one progress-over-time card per shown
 * goal, one line per shown metric - all sharing one time range
 * (`panelDomain`) so they line up, each fitting its own % scale - then the
 * current-progress bars. Read-only; the dashboard and a public link's page
 * both render it.
 */
function DashboardCharts({ charts, slotOf, loading = false }: DashboardChartsProps) {
  const { progress, metricsByGoal, metricPanels, now, panelDomain } = charts;
  return (
    <div className="d-flex flex-column gap-3">
      {loading ? (
        <Card>
          <CardBody>
            <div className="text-secondary py-4 text-center">Loading…</div>
          </CardBody>
        </Card>
      ) : (
        metricPanels.map(({ progress: p, projected, series, yMax }) => (
          <Card key={p.goal.id}>
            <CardHeader>
              <CardTitle>
                <span className="d-inline-flex align-items-center gap-2">
                  {p.goal.title}
                  {p.current !== null && <span className="gn-goal-pct">{formatPct(p.current)}</span>}
                  {projected !== null && (
                    <span
                      className="gn-goal-projection"
                      title="Linear projection: each metric's check-in trend carried to the target date"
                    >
                      → {formatPct(projected.pct)} by {markerDate.format(projected.t)}
                    </span>
                  )}
                  {(() => {
                    const health = goalHealth(p.current, projected?.pct ?? null, goalTargetTime(p.goal), now);
                    return health === "unknown" ? null : (
                      <span className={`gn-health is-${health}`} title="From the projection: on track = 100% by the target date, at risk = 80%+">
                        {HEALTH_LABELS[health]}
                      </span>
                    );
                  })()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {series.length === 0 ? (
                <p className="text-secondary small mb-0">
                  {(metricsByGoal.get(p.goal.id)?.length ?? 0) === 0 ? "No metrics yet." : "All metrics hidden."}
                </p>
              ) : (
                <ProgressLineChart
                  series={series}
                  // More room once the lines outnumber the palette.
                  height={series.length > MAX_GOALS ? 300 : 220}
                  domain={panelDomain && { ...panelDomain, yMax }}
                  markers={goalMarkers(p.goal, now)}
                  alwaysLegend
                  emptyText="No check-ins yet."
                  ariaLabel={`${p.goal.title}: metric progress over time`}
                />
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
          {loading ? (
            <div className="text-secondary py-4 text-center">Loading…</div>
          ) : (
            <ProgressBarChart rows={progress.map((p) => ({ progress: p, slot: slotOf(p.goal.id) }))} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default DashboardCharts;
