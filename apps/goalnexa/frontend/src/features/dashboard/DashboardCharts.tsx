import { Card, CardBody, CardHeader, CardTitle, formatDate, useLocale, useT, type Locale, type Translate } from "platform-core";
import type { Goal, GoalHealth } from "../../api/goals";
import { goalHealth, goalTargetTime, isHitRate } from "../../lib/progress";
import ProgressBarChart from "../../components/charts/ProgressBarChart";
import ProgressLineChart, { type ChartMarker } from "../../components/charts/ProgressLineChart";
import ValueLineChart from "../../components/charts/ValueLineChart";
import PeriodBarChart from "../../components/charts/PeriodBarChart";
import { formatPct } from "../../components/charts/chartUtils";
import { goalLabel, goalTeamName } from "../../api/dashboard";
import GoalTag from "../../components/GoalTag";
import { MAX_GOALS, type DashboardChartsData } from "./useDashboardCharts";
import messages from "./messages";

const markerDate = (t: number, locale: Locale) => formatDate(t, { month: "short", day: "numeric" }, locale);

const HEALTH_KEYS = {
  on_track: "health_on_track",
  at_risk: "health_at_risk",
  off_track: "health_off_track",
  achieved: "health_achieved",
} as const satisfies Record<Exclude<GoalHealth, "unknown">, string>;

/** Vertical lines on a goal's panel: now, and its target date if it has one. */
function goalMarkers(goal: Goal, now: number, t: Translate<(typeof messages)["en"]>, locale: Locale): ChartMarker[] {
  const target = goalTargetTime(goal);
  return [
    { t: now, label: t("now"), kind: "now" },
    ...(target === null ? [] : [{ t: target, label: t("targetMarker", { date: markerDate(target, locale) }), kind: "target" as const }]),
  ];
}

export interface DashboardChartsProps {
  charts: DashboardChartsData;
  /** A goal's color slot (1-8) on the current-progress bars. */
  slotOf: (goalId: string) => number;
  loading?: boolean;
  /** Team id -> name, to tag each team's copy of a template goal. */
  teamNames?: Map<string, string>;
}

/**
 * The dashboard's right-hand column: one progress-over-time card per shown
 * goal, one line per shown metric with a target and a small value chart
 * per tracked one (target = base, no %) - each goal on its own time range
 * and % scale (`panelDomains`) - then the current-progress bars. Read-only; the dashboard and a public link's page
 * both render it.
 */
function DashboardCharts({ charts, slotOf, loading = false, teamNames }: DashboardChartsProps) {
  const { progress, metricsByGoal, metricPanels, now, panelDomains } = charts;
  const t = useT(messages);
  const locale = useLocale();
  return (
    <div className="d-flex flex-column gap-3">
      {loading ? (
        <Card>
          <CardBody>
            <div className="text-secondary py-4 text-center">{t("loading")}</div>
          </CardBody>
        </Card>
      ) : (
        metricPanels.map(({ progress: p, projected, series, tracked, bars, shownCount }) => {
          const panelDomain = panelDomains.get(p.goal.id);
          return (
          <Card key={p.goal.id}>
            <CardHeader>
              <CardTitle>
                <span className="d-inline-flex align-items-center gap-2">
                  {p.goal.title}
                  <GoalTag goal={p.goal} team={goalTeamName(p.goal, teamNames)} />
                  {p.current !== null && <span className="gn-goal-pct">{formatPct(p.current)}</span>}
                  {projected !== null && (
                    <span
                      className="gn-goal-projection"
                      title={t("projectionHint")}
                    >
                      {t("projection", { pct: formatPct(projected.pct), date: markerDate(projected.t, locale) })}
                    </span>
                  )}
                  {p.current === null && tracked.length > 0 && (
                    <span className="gn-health is-tracking" title={t("trackingHint")}>
                      {t("tracking")}
                    </span>
                  )}
                  {(() => {
                    const target = goalTargetTime(p.goal);
                    // An open hit rate (before the goal's end) isn't "achieved" at 100%.
                    const openHitRate = (metricsByGoal.get(p.goal.id) ?? []).some(isHitRate) && (target === null || now < target + 86400000);
                    const health = goalHealth(p.current, projected?.pct ?? null, target, now, { canAchieve: !openHitRate });
                    return health === "unknown" ? null : (
                      <span className={`gn-health is-${health}`} title={t("healthHint")}>
                        {t(HEALTH_KEYS[health])}
                      </span>
                    );
                  })()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardBody>
              {shownCount === 0 && (
                <p className="text-secondary small mb-0">
                  {(metricsByGoal.get(p.goal.id)?.length ?? 0) === 0 ? t("noMetrics") : t("allMetricsHidden")}
                </p>
              )}
              {series.length > 0 && (
                <ProgressLineChart
                  series={series}
                  // More room once the lines outnumber the palette.
                  height={series.length > MAX_GOALS ? 300 : 220}
                  domain={panelDomain}
                  markers={goalMarkers(p.goal, now, t, locale)}
                  alwaysLegend
                  ariaLabel={t("chartLabel", { title: p.goal.title })}
                />
              )}
              {tracked.length > 0 && panelDomain && (
                <div className={series.length > 0 ? "mt-3" : undefined}>
                  {series.length > 0 && (
                    <div className="subheader mb-2" title={t("trackedHint")}>
                      {t("trackedNoTarget")}
                    </div>
                  )}
                  <div className="gn-tracked-grid">
                    {tracked.map((line) => (
                      <ValueLineChart key={line.id} {...line} tMin={panelDomain.tMin} tMax={panelDomain.tMax} now={now} />
                    ))}
                  </div>
                </div>
              )}
              {bars.length > 0 && (
                <div className={series.length > 0 || tracked.length > 0 ? "mt-3" : undefined}>
                  <div className="subheader mb-2">{t("perPeriod")}</div>
                  <div className="gn-tracked-grid">
                    {bars.map((bar) => (
                      <PeriodBarChart key={bar.id} label={bar.label} unit={bar.unit} slot={bar.slot} bars={bar.bars} quota={bar.quota} />
                    ))}
                  </div>
                </div>
              )}
              {tracked.length > 0 && !panelDomain && series.length === 0 && (
                <p className="text-secondary small mb-0">{t("noCheckIns")}</p>
              )}
            </CardBody>
          </Card>
          );
        })
      )}
      <Card>
        <CardHeader>
          <CardTitle>{t("currentProgress")}</CardTitle>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="text-secondary py-4 text-center">{t("loading")}</div>
          ) : (
            <ProgressBarChart rows={progress.map((p) => ({ progress: p, slot: slotOf(p.goal.id), label: goalLabel(p.goal, teamNames) }))} />
          )}
        </CardBody>
      </Card>
    </div>
  );
}

export default DashboardCharts;
