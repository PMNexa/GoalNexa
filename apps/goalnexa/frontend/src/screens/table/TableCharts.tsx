import { useState, type PointerEvent, type ReactNode } from "react";
import { seriesColor, seriesDash, seriesKey, useElementWidth } from "../dashboard/chartUtils";

const COMPACT = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const FULL = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export interface TableChartLine {
  key: string;
  label: string;
  /** Color slot (1-based, `seriesColor`); 0 = the goal's own line, drawn in the text color. */
  slot: number;
  /** Column key -> value. */
  points: Map<string, number>;
}

export interface TableChartCard {
  key: string;
  title: ReactNode;
  /** "%" for progress lines, else the metric's unit (a tracked metric's values). */
  unit: string;
  percent: boolean;
  lines: TableChartLine[];
}

export interface TableChartsProps {
  cards: TableChartCard[];
  /** Every column of the table, oldest first. */
  columns: string[];
  label: (column: string) => string;
}

/**
 * The check-in table as charts: per goal, its progress and each metric's
 * (in %) across the table's columns; a tracked metric (no target) gets its
 * own chart in its unit. Each chart spans only its own columns, from its
 * first check-in to its last; a line runs through columns without one.
 */
export function TableCharts({ cards, columns, label }: TableChartsProps) {
  const shown = cards.filter((card) => card.lines.some((line) => line.points.size > 0));
  if (shown.length === 0) return <div className="text-secondary p-3">No check-ins to chart.</div>;
  return (
    <div className="gn-charts gn-viz">
      <div className="row g-3">
        {shown.map((card) => (
          <div key={card.key} className="col-md-6 col-xxl-4">
            <div className="gn-chart-card">
              <div className="gn-chart-title">{card.title}</div>
              {card.lines.length > 1 && (
                <div className="gn-chart-legend mb-2">
                  {card.lines.map((line) => (
                    <span key={line.key} className="gn-legend-item">
                      <span className="gn-key" style={{ background: line.slot ? seriesKey(line.slot) : "var(--gn-text-primary)" }} />
                      {line.label}
                    </span>
                  ))}
                </div>
              )}
              <LineChart card={card} columns={columns} label={label} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LineChart({ card, columns, label }: { card: TableChartCard; columns: string[]; label: (column: string) => string }) {
  const [ref, width] = useElementWidth<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const HEIGHT = 150;
  const margin = { top: 8, right: 10, bottom: 22, left: 44 };
  const plotW = Math.max(width - margin.left - margin.right, 10);
  const plotH = HEIGHT - margin.top - margin.bottom;
  const has = (column: string) => card.lines.some((line) => line.points.has(column));
  const first = columns.findIndex(has);
  let last = columns.length - 1;
  while (last > first && !has(columns[last])) last -= 1;
  const cols = first < 0 ? [] : columns.slice(first, last + 1);
  const values = card.lines.flatMap((line) => [...line.points.values()]);
  const vMax = Math.max(card.percent ? 100 : 1, ...values) * 1.1;
  const vMin = Math.min(0, ...values);
  const x = (i: number) => margin.left + (cols.length > 1 ? (i / (cols.length - 1)) * plotW : plotW / 2);
  const y = (v: number) => margin.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
  const format = (v: number) => (card.percent ? `${Math.round(v)}%` : `${FULL.format(v)}${card.unit ? ` ${card.unit}` : ""}`);
  const color = (line: TableChartLine) => (line.slot ? seriesColor(line.slot) : "var(--gn-text-primary)");

  function path(line: TableChartLine): string {
    return cols
      .map((col, i) => (line.points.has(col) ? [x(i), y(line.points.get(col)!)] : null))
      .filter((p): p is number[] => p !== null)
      .map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`)
      .join("");
  }

  function handleMove(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const at = ((event.clientX - rect.left) / rect.width) * (cols.length - 1);
    setHover(Math.max(0, Math.min(cols.length - 1, Math.round(at))));
  }

  const TOOLTIP_W = 220;
  const hoverX = hover !== null ? x(hover) : 0;
  const tooltipLeft = hoverX + 12 + TOOLTIP_W > width ? Math.max(0, hoverX - 12 - TOOLTIP_W) : hoverX + 12;
  const ticks = card.percent ? [...new Set([vMin, 100])] : [vMax / 1.1, vMin];

  return (
    <div ref={ref} className="gn-viz">
      <svg viewBox={`0 0 ${width} ${HEIGHT}`} height={HEIGHT} role="img" aria-label={`${card.key} over time`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={margin.left} x2={margin.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--gn-grid)" strokeWidth={1} />
            <text className="gn-tick" x={margin.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
              {card.percent ? `${Math.round(v)}%` : COMPACT.format(v)}
            </text>
          </g>
        ))}
        <text className="gn-tick" x={x(0)} y={HEIGHT - 6} textAnchor={cols.length > 1 ? "start" : "middle"}>{label(cols[0])}</text>
        {cols.length > 1 && (
          <text className="gn-tick" x={x(cols.length - 1)} y={HEIGHT - 6} textAnchor="end">{label(cols[cols.length - 1])}</text>
        )}
        {card.lines.map((line) => (
          <g key={line.key}>
            <path
              d={path(line)}
              fill="none"
              stroke={color(line)}
              strokeWidth={line.slot ? 2 : 2.5}
              strokeDasharray={line.slot ? seriesDash(line.slot) : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {cols.length <= 31 &&
              cols.map((col, i) =>
                line.points.has(col) ? (
                  <circle key={col} cx={x(i)} cy={y(line.points.get(col)!)} r={2.5} fill={color(line)} stroke="var(--gn-surface)" strokeWidth={1} />
                ) : null,
              )}
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
          <div className="gn-tooltip-title">{label(cols[hover])}</div>
          {card.lines.map((line) => {
            // Between check-ins a line holds its last value.
            let at = hover;
            while (at >= 0 && !line.points.has(cols[at])) at -= 1;
            const v = at < 0 ? undefined : line.points.get(cols[at]);
            return (
              <div key={line.key} className="gn-tooltip-row">
                <span className="gn-key" style={{ background: line.slot ? seriesKey(line.slot) : "var(--gn-text-primary)" }} />
                <span className="gn-name">{line.label}</span>
                <span className="gn-num">{v === undefined ? "—" : format(v)}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
