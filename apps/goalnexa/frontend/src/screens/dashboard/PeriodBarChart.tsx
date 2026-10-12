import { useState } from "react";
import type { PeriodBar } from "../../lib/periods";
import { seriesColor, useElementWidth } from "./chartUtils";

const COMPACT = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const FULL = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

export interface PeriodBarChartProps {
  label: string;
  unit: string;
  slot: number;
  bars: PeriodBar[];
  /** The target per period, drawn as a dashed line; a bar at or over it is solid, under it lighter. */
  quota?: number | null;
  height?: number;
}

/**
 * Amounts per period (a day, week, ...) as bars, in the metric's unit -
 * for a target per period, against its quota line. Plain SVG like the
 * other charts; hover (or focus) a bar for its exact amount.
 */
function PeriodBarChart({ label, unit, slot, bars, quota = null, height: HEIGHT = 120 }: PeriodBarChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>(320);
  const [hover, setHover] = useState<number | null>(null);
  const suffix = unit ? ` ${unit}` : "";
  const margin = { top: 8, right: 8, bottom: 22, left: 44 };
  const plotW = Math.max(width - margin.left - margin.right, 10);
  const plotH = HEIGHT - margin.top - margin.bottom;
  const vMax = Math.max(1, quota ?? 0, ...bars.map((b) => b.value)) * 1.1;
  const step = plotW / Math.max(bars.length, 1);
  const barW = Math.max(2, Math.min(28, step * 0.7));
  const y = (v: number) => margin.top + plotH - (v / vMax) * plotH;
  const color = seriesColor(slot);
  const shown = hover !== null ? bars[hover] : bars[bars.length - 1];
  const hits = quota ? bars.filter((b) => b.value >= quota).length : null;

  return (
    <div ref={ref} className="gn-period-bars">
      <div className="d-flex justify-content-between small mb-1">
        <span className="fw-semibold">{label}</span>
        {shown && (
          <span className="text-secondary">
            {shown.label}: {FULL.format(shown.value)}
            {quota ? ` / ${FULL.format(quota)}` : ""}
            {suffix}
            {hits !== null && hover === null && ` · ${hits}/${bars.length} hit`}
          </span>
        )}
      </div>
      <svg width={width} height={HEIGHT} role="img" aria-label={`${label}: amount per period`} onPointerLeave={() => setHover(null)}>
        <line x1={margin.left} x2={margin.left + plotW} y1={y(0)} y2={y(0)} stroke="var(--tblr-border-color, #e6e7e9)" />
        <text x={margin.left - 6} y={y(vMax / 1.1) + 4} textAnchor="end" className="gn-tick">
          {COMPACT.format(vMax / 1.1)}
        </text>
        <text x={margin.left - 6} y={y(0) + 4} textAnchor="end" className="gn-tick">0</text>
        {bars.map((bar, i) => {
          const x = margin.left + i * step + (step - barW) / 2;
          const met = quota ? bar.value >= quota : true;
          return (
            <rect
              key={bar.start}
              x={x}
              y={y(bar.value)}
              width={barW}
              height={Math.max(0, y(0) - y(bar.value))}
              fill={color}
              opacity={met ? 1 : 0.45}
              rx={2}
              tabIndex={0}
              aria-label={`${bar.label}: ${FULL.format(bar.value)}${suffix}`}
              onPointerEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          );
        })}
        {quota ? (
          <line x1={margin.left} x2={margin.left + plotW} y1={y(quota)} y2={y(quota)} stroke="var(--tblr-secondary, #667382)"
            strokeDasharray="4 3" />
        ) : null}
        {bars.length > 0 && (
          <>
            <text x={margin.left} y={HEIGHT - 6} className="gn-tick">{bars[0].label}</text>
            {bars.length > 1 && (
              <text x={margin.left + plotW} y={HEIGHT - 6} textAnchor="end" className="gn-tick">{bars[bars.length - 1].label}</text>
            )}
          </>
        )}
      </svg>
    </div>
  );
}

export default PeriodBarChart;
