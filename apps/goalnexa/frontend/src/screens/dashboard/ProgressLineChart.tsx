import { useState, type PointerEvent } from "react";
import type { ProgressPoint } from "../../lib/progress";
import { formatPct, pctDomainMax, pctTicks, seriesColor, truncate, useElementWidth } from "./chartUtils";

export interface LineSeries {
  id: string;
  label: string;
  slot: number;
  points: ProgressPoint[];
  /** Extra tooltip line under the %, e.g. the actual reading ("120 / 350 KM"). */
  formatDetail?: (point: ProgressPoint) => string | null;
  /** Where the series is headed (e.g. at the goal's target date) - drawn dashed from its last point, hollow end dot. */
  projection?: ProgressPoint | null;
}

const DAY = 86_400_000;

/** The point in effect at `t` - the latest one at or before it (values hold between check-ins). */
function stepPointAt(points: ProgressPoint[], t: number): ProgressPoint | null {
  let current: ProgressPoint | null = null;
  for (const point of points) {
    if (point.t > t) break;
    current = point;
  }
  return current;
}

/** Straight segments from one check-in to the next. */
function linePath(points: ProgressPoint[], x: (t: number) => number, y: (pct: number) => number): string {
  return points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t)},${y(p.pct)}`).join("");
}

/**
 * Progress over time, one 2px line per series joining its check-ins with
 * straight segments, a single % axis. Hover snaps a crosshair to the
 * nearest check-in time and lists every series' latest reading as of then;
 * the hover dot only marks series with a check-in AT that time, since a
 * held value between two check-ins sits off the diagonal. <= 4 series also get direct end
 * labels; the legend above is always there for >= 2. A series' `projection`
 * continues it as a dashed segment; hovering at or past its time shows the
 * projected reading, marked as such.
 */
export interface ProgressLineChartProps {
  series: LineSeries[];
  /** @default 280 */
  height?: number;
  /** Shown instead of the chart when no series has a point yet. */
  emptyText?: string;
  /** Names what the lines are, for the SVG's accessible label. */
  ariaLabel?: string;
  /** Fixed scales, e.g. so small multiples share one time range. Omitted = fit this chart's own data. */
  domain?: ChartDomain;
  /** Show the legend even for one series - when the surrounding title doesn't name the line (a panel titled by goal, lines = metrics). */
  alwaysLegend?: boolean;
  /** Labelled vertical lines, e.g. now and the goal's target date. Ones outside the time range are skipped. */
  markers?: ChartMarker[];
}

export interface ChartMarker {
  t: number;
  label: string;
  /** "target" is dashed; "now" is a solid hairline. */
  kind: "now" | "target";
}

export interface ChartDomain {
  tMin: number;
  tMax: number;
  yMax: number;
}

/**
 * Time range (padded to >= 1 day, so a single moment sits mid-plot) and %
 * ceiling fitting every point given. `extraTimes` (now, target dates) widen
 * the time range only, so their markers land on the plot.
 */
export function fitDomain(points: ProgressPoint[], extraTimes: number[] = []): ChartDomain | null {
  if (points.length === 0) return null;
  const times = [...points.map((p) => p.t), ...extraTimes];
  let tMin = Math.min(...times);
  let tMax = Math.max(...times);
  if (tMax - tMin < DAY) {
    tMin -= DAY / 2;
    tMax += DAY / 2;
  }
  return { tMin, tMax, yMax: pctDomainMax(points.map((p) => p.pct)) };
}

function ProgressLineChart({
  series,
  height: HEIGHT = 280,
  emptyText = "No check-ins yet.",
  ariaLabel = "Progress over time",
  domain,
  alwaysLegend = false,
  markers = [],
}: ProgressLineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>(720);
  const [hoverT, setHoverT] = useState<number | null>(null);

  const drawn = series.filter((s) => s.points.length > 0);
  const allPoints = drawn.flatMap((s) => s.points);
  if (allPoints.length === 0) {
    return (
      <div ref={ref} className="gn-viz text-secondary small py-3">
        {emptyText}
      </div>
    );
  }

  // Direct end labels need ~130px of their own - only when the plot keeps >= ~400px.
  const directLabels = drawn.length <= 4 && width >= 560;
  const margin = { top: 12, right: directLabels ? 132 : 16, bottom: 28, left: 44 };
  const plotW = width - margin.left - margin.right;
  const plotH = HEIGHT - margin.top - margin.bottom;

  const projections = drawn.flatMap((s) => (s.projection ? [s.projection] : []));
  const { tMin, tMax, yMax } = domain ?? (fitDomain([...allPoints, ...projections]) as ChartDomain);
  const x = (t: number) => margin.left + ((t - tMin) / (tMax - tMin)) * plotW;
  const y = (pct: number) => margin.top + plotH - (pct / yMax) * plotH;

  const spansYears = new Date(tMin).getFullYear() !== new Date(tMax).getFullYear();
  const tickFormat = new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    ...(spansYears ? { year: "2-digit" } : {}),
    ...(tMax - tMin < 3 * DAY ? { hour: "numeric" } : {}),
  });
  const tooltipFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
  const xTickCount = Math.max(2, Math.min(6, Math.floor(plotW / 110)));
  const xTicks = Array.from({ length: xTickCount }, (_, i) => tMin + ((tMax - tMin) * i) / (xTickCount - 1));

  const times = [...new Set([...allPoints, ...projections].map((p) => p.t))].sort((a, b) => a - b);

  function handleMove(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const t = tMin + ((event.clientX - rect.left) / rect.width) * (tMax - tMin);
    let nearest = times[0];
    for (const candidate of times) if (Math.abs(candidate - t) < Math.abs(nearest - t)) nearest = candidate;
    setHoverT(nearest);
  }

  // End labels: at each line's last value, nudged apart only enough not
  // to overlap (min 14px), keeping order.
  const endLabels = directLabels
    ? drawn
        .map((s) => ({ s, y: y(s.points[s.points.length - 1].pct) }))
        .sort((a, b) => a.y - b.y)
        .reduce<{ s: LineSeries; y: number; labelY: number }[]>((acc, item) => {
          const prev = acc[acc.length - 1];
          acc.push({ ...item, labelY: prev ? Math.max(item.y, prev.labelY + 14) : item.y });
          return acc;
        }, [])
    : [];

  const hoverRows =
    hoverT === null
      ? []
      : drawn
          .map((s) => {
            const projected = !!s.projection && hoverT >= s.projection.t;
            return { s, projected, point: projected ? (s.projection as ProgressPoint) : stepPointAt(s.points, hoverT) };
          })
          .filter((row): row is { s: LineSeries; projected: boolean; point: ProgressPoint } => row.point !== null)
          .map(({ s, projected, point }) => ({ s, projected, point, value: point.pct }))
          .sort((a, b) => b.value - a.value);
  const hoverX = hoverT === null ? 0 : x(hoverT);
  const TOOLTIP_W = 260;
  const tooltipLeft = hoverX + 12 + TOOLTIP_W > width ? Math.max(0, hoverX - 12 - TOOLTIP_W) : hoverX + 12;

  return (
    <div ref={ref} className="gn-viz">
      {(drawn.length >= 2 || alwaysLegend) && (
        <div className="gn-legend" aria-hidden="true">
          {drawn.map((s) => (
            <span key={s.id} className="gn-legend-item">
              <span className="gn-key" style={{ background: seriesColor(s.slot) }} />
              <span>{s.label}</span>
            </span>
          ))}
        </div>
      )}
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        height={HEIGHT}
        role="img"
        aria-label={`${ariaLabel}: ${drawn.map((s) => s.label).join(", ")}`}
      >
        {pctTicks(yMax, plotH, 28).map((tick) => (
          <g key={tick}>
            <line
              x1={margin.left}
              x2={margin.left + plotW}
              y1={y(tick)}
              y2={y(tick)}
              stroke={tick === 0 ? "var(--gn-axis)" : "var(--gn-grid)"}
              strokeWidth={1}
            />
            <text className="gn-tick" x={margin.left - 8} y={y(tick)} dy="0.32em" textAnchor="end">
              {tick}%
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text
            key={t}
            className="gn-tick"
            x={x(t)}
            y={HEIGHT - 8}
            textAnchor={i === 0 ? "start" : i === xTicks.length - 1 ? "end" : "middle"}
          >
            {tickFormat.format(t)}
          </text>
        ))}

        {markers
          .filter((m) => m.t >= tMin && m.t <= tMax)
          .map((m) => {
            const mx = x(m.t);
            // Label hugs the line on the side with room for it.
            const labelRight = mx < margin.left + plotW - 90;
            return (
              <g key={`${m.kind}-${m.t}`} pointerEvents="none">
                <line
                  x1={mx}
                  x2={mx}
                  y1={margin.top}
                  y2={margin.top + plotH}
                  stroke={m.kind === "target" ? "var(--gn-text-secondary)" : "var(--gn-axis)"}
                  strokeWidth={1}
                  strokeDasharray={m.kind === "target" ? "4 3" : undefined}
                />
                <text
                  className="gn-tick gn-marker"
                  x={mx + (labelRight ? 4 : -4)}
                  y={margin.top + 10}
                  textAnchor={labelRight ? "start" : "end"}
                >
                  {m.label}
                </text>
              </g>
            );
          })}

        {drawn.map((s) => (
          <g key={s.id}>
            {s.points.length > 1 && (
              <path
                d={linePath(s.points, x, y)}
                fill="none"
                stroke={seriesColor(s.slot)}
                strokeWidth={2}
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}
            {s.projection && (
              <>
                <path
                  d={linePath([s.points[s.points.length - 1], s.projection], x, y)}
                  fill="none"
                  stroke={seriesColor(s.slot)}
                  strokeWidth={2}
                  strokeDasharray="5 4"
                  strokeLinecap="round"
                  opacity={0.7}
                />
                <circle
                  cx={x(s.projection.t)}
                  cy={y(s.projection.pct)}
                  r={3.5}
                  fill="var(--gn-surface)"
                  stroke={seriesColor(s.slot)}
                  strokeWidth={2}
                />
              </>
            )}
            {(s.points.length <= 24 ? s.points : [s.points[s.points.length - 1]]).map((p, i) => (
              <circle
                // Index, not `p.t` - two check-ins can share a timestamp.
                key={i}
                cx={x(p.t)}
                cy={y(p.pct)}
                r={4}
                fill={seriesColor(s.slot)}
                stroke="var(--gn-surface)"
                strokeWidth={2}
              />
            ))}
          </g>
        ))}

        {endLabels.map(({ s, y: lineY, labelY }) => {
          // Labels all sit past the plot's right edge - a line ending
          // early would otherwise have its label drawn over the others.
          // A hairline leader runs from the line's last point to its label.
          const lastX = x(s.points[s.points.length - 1].t);
          const edge = margin.left + plotW;
          const needsLeader = labelY !== lineY || edge - lastX > 8;
          return (
            <g key={s.id}>
              {needsLeader && (
                <polyline
                  points={`${lastX + 6},${lineY} ${edge + 4},${lineY} ${edge + 12},${labelY}`}
                  fill="none"
                  stroke="var(--gn-axis)"
                  strokeWidth={1}
                />
              )}
              <text className="gn-label" x={edge + 16} y={labelY} dy="0.32em">
                <tspan className="gn-value">{formatPct(s.points[s.points.length - 1].pct)}</tspan>{" "}
                {truncate(s.label, 14)}
              </text>
            </g>
          );
        })}

        {hoverT !== null && (
          <g pointerEvents="none">
            <line x1={hoverX} x2={hoverX} y1={margin.top} y2={margin.top + plotH} stroke="var(--gn-axis)" strokeWidth={1} />
            {hoverRows.filter(({ point, projected }) => point.t === hoverT && !projected).map(({ s, value }) => (
              <circle
                key={s.id}
                cx={hoverX}
                cy={y(value)}
                r={5}
                fill={seriesColor(s.slot)}
                stroke="var(--gn-surface)"
                strokeWidth={2}
              />
            ))}
          </g>
        )}
        <rect
          x={margin.left}
          y={margin.top}
          width={plotW}
          height={plotH}
          fill="transparent"
          onPointerMove={handleMove}
          onPointerLeave={() => setHoverT(null)}
        />
      </svg>
      {hoverT !== null && hoverRows.length > 0 && (
        <div className="gn-tooltip" style={{ left: tooltipLeft, top: margin.top + (drawn.length >= 2 ? 28 : 0) }}>
          <div className="gn-tooltip-title">{tooltipFormat.format(hoverT)}</div>
          {hoverRows.map(({ s, point, value, projected }) => {
            const detail = s.formatDetail?.(point);
            return (
              <div key={s.id} className="gn-tooltip-item">
                <div className="gn-tooltip-row">
                  <span className="gn-key" style={{ background: seriesColor(s.slot) }} />
                  <span className="gn-name">
                    {s.label}
                    {projected && <span className="gn-projected"> · projected</span>}
                  </span>
                  <span className="gn-num">{formatPct(value)}</span>
                </div>
                {detail && <div className="gn-tooltip-detail">{detail}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ProgressLineChart;
