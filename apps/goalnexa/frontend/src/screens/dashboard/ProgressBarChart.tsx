import { useState } from "react";
import type { GoalProgress } from "../../lib/progress";
import { formatPct, pctDomainMax, pctTicks, seriesColor, truncate, useElementWidth } from "./chartUtils";

export interface BarRow {
  progress: GoalProgress;
  slot: number;
}

const BAR = 20;
const ROW = 36;
const RADIUS = 4;

/** Rect with only the data-end (right) corners rounded, square at the baseline. */
function barPath(x0: number, x1: number, yTop: number, h: number): string {
  const r = Math.min(RADIUS, (x1 - x0) / 2, h / 2);
  if (x1 - x0 < 0.5) return "";
  return [
    `M${x0},${yTop}`,
    `H${x1 - r}`,
    `Q${x1},${yTop} ${x1},${yTop + r}`,
    `V${yTop + h - r}`,
    `Q${x1},${yTop + h} ${x1 - r},${yTop + h}`,
    `H${x0}`,
    "Z",
  ].join(" ");
}

/**
 * Current progress per goal - horizontal bars from one 0% baseline,
 * value at the tip, a 100% target line. Each bar wears its goal's own
 * series color (same slot as the line chart) since the bars ARE the
 * goals - identity, not magnitude. A goal with no usable metrics gets a
 * "no metrics" note instead of a misleading 0 bar.
 */
function ProgressBarChart({ rows }: { rows: BarRow[] }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(720);
  const [hover, setHover] = useState<{ row: BarRow; top: number } | null>(null);
  const TOOLTIP_W = 240;

  const labelW = Math.min(200, Math.max(110, width * 0.28));
  const margin = { top: 8, right: 52, bottom: 24, left: labelW + 12 };
  const plotW = width - margin.left - margin.right;
  const height = margin.top + rows.length * ROW + margin.bottom;
  const xMax = pctDomainMax(rows.map((r) => r.progress.current ?? 0));
  const x = (pct: number) => margin.left + (pct / xMax) * plotW;
  const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

  return (
    <div ref={ref} className="gn-viz">
      <svg viewBox={`0 0 ${width} ${height}`} height={height} role="img" aria-label="Current progress by goal">
        {pctTicks(xMax, plotW, 44).map((tick) => (
          <g key={tick}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke={tick === 0 ? "var(--gn-axis)" : "var(--gn-grid)"}
              strokeWidth={1}
            />
            <text className="gn-tick" x={x(tick)} y={height - 6} textAnchor="middle">
              {tick}%
            </text>
          </g>
        ))}
        {xMax > 100 && (
          <line x1={x(100)} x2={x(100)} y1={margin.top} y2={height - margin.bottom} stroke="var(--gn-text-secondary)" strokeWidth={1} />
        )}

        {rows.map((row, i) => {
          const rowTop = margin.top + i * ROW;
          const barTop = rowTop + (ROW - BAR) / 2;
          const { current } = row.progress;
          return (
            <g
              key={row.progress.goal.id}
              onPointerEnter={() => setHover({ row, top: rowTop })}
              onPointerLeave={() => setHover(null)}
            >
              {/* Hit target: the whole row, not just the bar. */}
              <rect x={0} y={rowTop} width={width} height={ROW} fill="transparent" />
              <text className="gn-label" x={labelW} y={rowTop + ROW / 2} dy="0.32em" textAnchor="end">
                {truncate(row.progress.goal.title, Math.floor(labelW / 7))}
              </text>
              {current === null ? (
                <text className="gn-tick" x={margin.left + 6} y={rowTop + ROW / 2} dy="0.32em">
                  No metrics with a target
                </text>
              ) : (
                <>
                  <path d={barPath(x(0), x(current), barTop, BAR)} fill={seriesColor(row.slot)} />
                  <text className="gn-value" x={x(current) + 6} y={rowTop + ROW / 2} dy="0.32em">
                    {formatPct(current)}
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      {hover && (
        <div
          className="gn-tooltip"
          // Above the hovered row (below it for the first row), right-aligned to the bar's end - never over a neighbour's bar or value.
          style={{
            left: Math.max(0, Math.min(x(hover.row.progress.current ?? 0) - TOOLTIP_W / 2, width - TOOLTIP_W)),
            ...(hover.top - 56 >= 0 ? { top: hover.top - 56 } : { top: hover.top + ROW }),
          }}
        >
          <div className="gn-tooltip-row">
            <span className="gn-key" style={{ background: seriesColor(hover.row.slot) }} />
            <span className="gn-name">{hover.row.progress.goal.title}</span>
            <span className="gn-num">
              {hover.row.progress.current === null ? "—" : formatPct(hover.row.progress.current)}
            </span>
          </div>
          <div className="gn-tooltip-title mt-1 mb-0">
            {hover.row.progress.metricCount} metric{hover.row.progress.metricCount === 1 ? "" : "s"}
            {" · "}
            {hover.row.progress.lastCheckIn === null
              ? "no check-ins"
              : `last check-in ${dateFormat.format(hover.row.progress.lastCheckIn)}`}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProgressBarChart;
