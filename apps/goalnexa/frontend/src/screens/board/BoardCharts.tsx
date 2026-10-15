import { Fragment, useState, type PointerEvent, type ReactNode } from "react";
import type { BoardMetric, CellNumbers } from "../../lib/api/teamBoard";
import { seriesColor, seriesDash, seriesKey, useElementWidth } from "../dashboard/chartUtils";

const COMPACT = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const FULL = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/** One team's (or total's) cells - a row of the board. */
export interface ChartSeries {
  key: string;
  label: string;
  /** A total: listed apart from the teams (its numbers are their sum, so it would dwarf them). */
  total: boolean;
  metrics: Record<string, CellNumbers>;
}

/** A cell as one number: its value, its target (null: none) and how far along it is (null: no %). */
export interface ChartPoint {
  value: number | null;
  target: number | null;
  pct: number | null;
}

export interface ChartGoal {
  id: string;
  title: string;
  depth: number;
}

function heatClass(pct: number | null): string {
  if (pct === null) return "gn-bar-plain";
  if (pct >= 100) return "gn-bar-done";
  if (pct >= 70) return "gn-bar-good";
  if (pct >= 40) return "gn-bar-mid";
  return "gn-bar-low";
}

function valueText(point: ChartPoint, unit: string): string {
  if (point.value === null) return "—";
  return `${FULL.format(point.value)}${point.target !== null ? ` / ${FULL.format(point.target)}` : ""}${unit ? ` ${unit}` : ""}`;
}

/** The goals in board order, each with its metrics - one heading and a grid of metric cards each. */
function GoalSections({
  goals,
  metrics,
  card,
}: {
  goals: ChartGoal[];
  metrics: BoardMetric[];
  card: (metric: BoardMetric) => ReactNode;
}) {
  return (
    <>
      {goals.map((goal) => {
        const own = metrics.filter((m) => m.template_goal === goal.id);
        if (own.length === 0) return null;
        return (
          <section key={goal.id} className="mb-3">
            <h4 className="mb-2" style={{ paddingLeft: `${goal.depth * 1.1}rem` }}>{goal.title}</h4>
            <div className="row g-3">
              {own.map((metric) => (
                <div key={metric.id} className="col-md-6 col-xxl-4">
                  <div className="gn-chart-card">
                    <div className="gn-chart-title">
                      {metric.name}
                      {metric.unit && <span className="text-secondary"> ({metric.unit})</span>}
                    </div>
                    {card(metric)}
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </>
  );
}

export interface BoardBarChartsProps {
  goals: ChartGoal[];
  metrics: BoardMetric[];
  series: ChartSeries[];
  point: (numbers: CellNumbers, metric: BoardMetric) => ChartPoint;
}

/**
 * Check in mode's chart: per metric, one bar per team, its length the
 * team's % of its own target (so teams with different targets compare,
 * and a total fits next to them); the target is the tick at 100%. A
 * metric with no target: bars by value instead. Totals come last.
 */
export function BoardBarCharts({ goals, metrics, series, point }: BoardBarChartsProps) {
  return (
    <GoalSections
      goals={goals}
      metrics={metrics}
      card={(metric) => {
        const rows = series
          .filter((s) => s.metrics[metric.id])
          .map((s) => ({ series: s, point: point(s.metrics[metric.id], metric) }))
          .sort((a, b) => Number(a.series.total) - Number(b.series.total));
        if (rows.length === 0) return <div className="text-secondary small">No team has this metric.</div>;
        const pctMax = Math.max(100, ...rows.map((r) => r.point.pct ?? 0));
        const valueMax = Math.max(1, ...rows.filter((r) => r.point.pct === null).map((r) => r.point.value ?? 0));
        return (
          <div className="gn-bars">
            {rows.map(({ series: s, point: p }, index) => {
              const width = p.pct !== null ? (Math.max(0, p.pct) / pctMax) * 100 : ((p.value ?? 0) / valueMax) * 100;
              const firstTotal = s.total && (index === 0 || !rows[index - 1].series.total);
              return (
                <Fragment key={s.key}>
                {firstTotal && index > 0 && <span className="gn-bar-divider" />}
                <div className={`gn-bar-row${s.total ? " gn-bar-total" : ""}`}>
                  <span className="gn-bar-name" title={s.total ? `${s.label} (total)` : s.label}>
                    {s.label}
                    {s.total && <span className="text-secondary"> · total</span>}
                  </span>
                  <span className="gn-bar-track" title={valueText(p, metric.unit)}>
                    <span className={`gn-bar-fill ${heatClass(p.pct)}`} style={{ width: `${Math.max(width, 0)}%` }} />
                    {p.pct !== null && <span className="gn-bar-target" style={{ left: `${(100 / pctMax) * 100}%` }} />}
                  </span>
                  <span className="gn-bar-value">
                    {valueText(p, "")}
                    {p.pct !== null && <span className="text-secondary"> · {Math.round(p.pct)}%</span>}
                  </span>
                </div>
                </Fragment>
              );
            })}
          </div>
        );
      }}
    />
  );
}

export interface BoardLineChartsProps {
  goals: ChartGoal[];
  metrics: BoardMetric[];
  series: ChartSeries[];
  /** The periods' first days ("YYYY-MM-DD"), oldest first, and how to name them. */
  starts: string[];
  label: (start: string) => string;
}

/**
 * "Over time"'s chart: per metric, one line per team across the periods
 * (a gap where a period has no check-in); the target per period is a
 * dashed line when the teams share it. Totals aren't drawn - they'd
 * flatten the teams - but hovering a period lists them with the teams.
 */
export function BoardLineCharts({ goals, metrics, series, starts, label }: BoardLineChartsProps) {
  const teams = series.filter((s) => !s.total);
  return (
    <>
      {teams.length > 0 && (
        <div className="gn-chart-legend mb-3">
          {teams.map((s, i) => (
            <span key={s.key} className="gn-legend-item">
              <span className="gn-key" style={{ background: seriesKey(i + 1) }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <GoalSections
        goals={goals}
        metrics={metrics}
        card={(metric) => <LineChart metric={metric} series={series} starts={starts} label={label} />}
      />
    </>
  );
}

function LineChart({
  metric,
  series,
  starts,
  label,
}: {
  metric: BoardMetric;
  series: ChartSeries[];
  starts: string[];
  label: (start: string) => string;
}) {
  const [ref, width] = useElementWidth<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const HEIGHT = 150;
  const margin = { top: 8, right: 10, bottom: 22, left: 44 };
  const plotW = Math.max(width - margin.left - margin.right, 10);
  const plotH = HEIGHT - margin.top - margin.bottom;
  const teams = series.filter((s) => !s.total);
  const cell = (s: ChartSeries, i: number) => s.metrics[metric.id]?.history?.[i] ?? null;
  // The target per period, when every team that has one shares it.
  const quotas = starts.map((_, i) => {
    const set = new Set(teams.map((s) => cell(s, i)?.quota).filter((q): q is number => q !== null && q !== undefined));
    return set.size === 1 ? [...set][0] : null;
  });
  const values = teams.flatMap((s) => starts.map((_, i) => cell(s, i)?.value ?? null)).filter((v): v is number => v !== null);
  const vMax = Math.max(1, ...values, ...quotas.filter((q): q is number => q !== null)) * 1.1;
  const vMin = Math.min(0, ...values);
  const x = (i: number) => margin.left + (starts.length > 1 ? (i / (starts.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => margin.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;

  // A line per team, broken where a period has no value.
  function path(s: ChartSeries): string {
    let d = "";
    let pen = false;
    starts.forEach((_, i) => {
      const v = cell(s, i)?.value;
      if (v === null || v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i)},${y(v)}`;
      pen = true;
    });
    return d;
  }
  const quotaPath = quotas
    .map((q, i) => (q === null ? null : `${i === 0 || quotas[i - 1] === null ? "M" : "L"}${x(i)},${y(q)}`))
    .filter(Boolean)
    .join("");

  function handleMove(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - rect.left) / rect.width) * (starts.length - 1);
    setHover(Math.max(0, Math.min(starts.length - 1, Math.round(at))));
  }

  const TOOLTIP_W = 220;
  const hoverX = hover !== null ? x(hover) : 0;
  const tooltipLeft = hoverX + 12 + TOOLTIP_W > width ? Math.max(0, hoverX - 12 - TOOLTIP_W) : hoverX + 12;
  const unit = metric.unit ? ` ${metric.unit}` : "";

  if (starts.length === 0) return <div className="text-secondary small">No check-ins in these periods.</div>;
  return (
    <div ref={ref} className="gn-viz">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} height={HEIGHT} role="img" aria-label={`${metric.name} per period, one line per team`}>
        {[vMax / 1.1, vMin].map((v) => (
          <g key={v}>
            <line x1={margin.left} x2={margin.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--gn-grid)" strokeWidth={1} />
            <text className="gn-tick" x={margin.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
              {COMPACT.format(v)}
            </text>
          </g>
        ))}
        <text className="gn-tick" x={x(0)} y={HEIGHT - 6} textAnchor="start">{label(starts[0])}</text>
        {starts.length > 1 && (
          <text className="gn-tick" x={x(starts.length - 1)} y={HEIGHT - 6} textAnchor="end">{label(starts[starts.length - 1])}</text>
        )}
        {quotaPath && <path d={quotaPath} fill="none" stroke="var(--gn-text-secondary)" strokeWidth={1} strokeDasharray="4 3" />}
        {teams.map((s, index) => (
          <g key={s.key}>
            <path
              d={path(s)}
              fill="none"
              stroke={seriesColor(index + 1)}
              strokeWidth={2}
              strokeDasharray={seriesDash(index + 1)}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {starts.length <= 16 &&
              starts.map((start, i) => {
                const v = cell(s, i)?.value;
                return v === null || v === undefined ? null : (
                  <circle key={start} cx={x(i)} cy={y(v)} r={2.5} fill={seriesColor(index + 1)} stroke="var(--gn-surface)" strokeWidth={1} />
                );
              })}
          </g>
        ))}
        {hover !== null && (
          <line x1={hoverX} x2={hoverX} y1={margin.top} y2={margin.top + plotH} stroke="var(--gn-axis)" strokeWidth={1} pointerEvents="none" />
        )}
        <rect
          x={margin.left}
          y={margin.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div className="gn-tooltip" style={{ left: tooltipLeft, top: 8, maxWidth: TOOLTIP_W }}>
          <div className="gn-tooltip-title">{label(starts[hover])}</div>
          {[...teams, ...series.filter((s) => s.total)].map((s) => {
            const c = cell(s, hover);
            if (!s.metrics[metric.id]) return null;
            const teamIndex = teams.indexOf(s);
            return (
              <div key={s.key} className="gn-tooltip-row">
                {teamIndex >= 0 ? <span className="gn-key" style={{ background: seriesKey(teamIndex + 1) }} /> : <span className="gn-key" />}
                <span className="gn-name">{s.total ? `${s.label} · total` : s.label}</span>
                <span className="gn-num">
                  {c?.value === null || c === null ? "—" : FULL.format(c.value)}
                  {c?.quota !== null && c?.quota !== undefined ? ` / ${FULL.format(c.quota)}` : ""}
                  {unit}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const BOARD_CHART_CSS = `.gn-charts { padding: 1rem; }
.gn-chart-card { border: 1px solid var(--tblr-border-color, #e6e7e9); border-radius: 6px; padding: .6rem .75rem; height: 100%; background: var(--tblr-bg-surface, #fff); }
.gn-chart-title { font-weight: 600; margin-bottom: .5rem; }
.gn-chart-legend { display: flex; flex-wrap: wrap; gap: .4rem 1rem; font-size: .8rem; }
.gn-legend-item { display: inline-flex; align-items: center; gap: .35rem; }
.gn-bars { display: grid; grid-template-columns: minmax(4rem, max-content) 1fr max-content; gap: .3rem .6rem; align-items: center; font-size: .8rem; }
.gn-bar-row { display: contents; }
.gn-bar-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 10rem; }
.gn-bar-total .gn-bar-name, .gn-bar-total .gn-bar-value { font-weight: 600; }
.gn-bar-divider { grid-column: 1 / -1; border-top: 1px dashed var(--tblr-border-color, #e6e7e9); }
.gn-bar-track { position: relative; height: .7rem; border-radius: 3px; background: var(--tblr-bg-surface-secondary, #f1f3f6); }
.gn-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; }
.gn-bar-target { position: absolute; top: -.2rem; bottom: -.2rem; width: 2px; margin-left: -1px; background: var(--tblr-secondary, #667382); }
.gn-bar-value { font-variant-numeric: tabular-nums; text-align: right; white-space: nowrap; }
.gn-bar-done { background: var(--tblr-success, #2fb344); }
.gn-bar-good { background: color-mix(in srgb, var(--tblr-success, #2fb344) 60%, transparent); }
.gn-bar-mid { background: var(--tblr-warning, #f76707); }
.gn-bar-low { background: var(--tblr-danger, #d63939); }
.gn-bar-plain { background: var(--tblr-primary, #066fd1); }
`;
