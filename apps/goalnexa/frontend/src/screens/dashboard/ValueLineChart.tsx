import { useState, type PointerEvent } from "react";
import type { ValuePoint } from "../../lib/progress";
import { seriesColor, seriesDash, seriesKey, useElementWidth } from "./chartUtils";

const COMPACT = new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 });
const FULL = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
const TOOLTIP_DATE = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });
const AXIS_DATE = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });
const SOURCE_LABELS = { agent: "AI agent", ingest: "ingest URL" } as const;

export interface ValueLineChartProps {
  label: string;
  unit: string;
  slot: number;
  points: ValuePoint[];
  /** The panel's time range, so these line up with its % chart. */
  tMin: number;
  tMax: number;
  /** Drawn as a hairline when inside the range. */
  now?: number;
  height?: number;
}

/**
 * A tracked metric (target = base, so no %) over time, in its own unit:
 * one small chart per metric, since a revenue in đ and a share in % can't
 * share an axis. Straight segments between check-ins, the y axis fitted to
 * the readings (not from 0 - it's the trend that matters), hover shows the
 * reading in effect at the nearest check-in.
 */
function ValueLineChart({ label, unit, slot, points, tMin, tMax, now, height: HEIGHT = 112 }: ValueLineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>(320);
  const [hover, setHover] = useState<ValuePoint | null>(null);
  const suffix = unit ? ` ${unit}` : "";
  const latest = points[points.length - 1];

  const margin = { top: 6, right: 8, bottom: 22, left: 48 };
  const plotW = width - margin.left - margin.right;
  const plotH = HEIGHT - margin.top - margin.bottom;
  const values = points.map((p) => p.value);
  let vMin = Math.min(...values);
  let vMax = Math.max(...values);
  if (vMin === vMax) {
    // A flat line (or one reading) sits mid-plot.
    const pad = Math.abs(vMin) * 0.1 || 1;
    vMin -= pad;
    vMax += pad;
  }
  const x = (t: number) => margin.left + ((t - tMin) / (tMax - tMin)) * plotW;
  const y = (v: number) => margin.top + plotH - ((v - vMin) / (vMax - vMin)) * plotH;
  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.t)},${y(p.value)}`).join("");

  function handleMove(event: PointerEvent<SVGRectElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const t = tMin + ((event.clientX - rect.left) / rect.width) * (tMax - tMin);
    let nearest = points[0];
    for (const p of points) if (Math.abs(p.t - t) < Math.abs(nearest.t - t)) nearest = p;
    setHover(nearest);
  }

  const TOOLTIP_W = 200;
  const hoverX = hover ? x(hover.t) : 0;
  const tooltipLeft = hoverX + 12 + TOOLTIP_W > width ? Math.max(0, hoverX - 12 - TOOLTIP_W) : hoverX + 12;

  return (
    <div ref={ref} className="gn-viz gn-tracked">
      <div className="gn-tracked-head">
        <span className="gn-key" style={{ background: seriesKey(slot) }} />
        <span className="gn-tracked-name" title={label}>
          {label}
        </span>
        <span className="gn-tracked-value" title={latest ? `${FULL.format(latest.value)}${suffix}` : undefined}>
          {latest ? `${COMPACT.format(latest.value)}${suffix}` : "No check-ins yet"}
        </span>
      </div>
      {points.length > 0 && (
        <svg viewBox={`0 0 ${width} ${HEIGHT}`} height={HEIGHT} role="img" aria-label={`${label} over time, in ${unit || "its unit"}`}>
          {[vMax, vMin].map((v) => (
            <g key={v}>
              <line x1={margin.left} x2={margin.left + plotW} y1={y(v)} y2={y(v)} stroke="var(--gn-grid)" strokeWidth={1} />
              <text className="gn-tick" x={margin.left - 6} y={y(v)} dy="0.32em" textAnchor="end">
                {COMPACT.format(v)}
              </text>
            </g>
          ))}
          {[tMin, tMax].map((t, i) => (
            <text key={i} className="gn-tick" x={x(t)} y={HEIGHT - 6} textAnchor={i === 0 ? "start" : "end"}>
              {AXIS_DATE.format(t)}
            </text>
          ))}
          {now !== undefined && now >= tMin && now <= tMax && (
            <g pointerEvents="none">
              <line x1={x(now)} x2={x(now)} y1={margin.top} y2={margin.top + plotH} stroke="var(--gn-axis)" strokeWidth={1} />
              <text className="gn-tick gn-marker" x={x(now)} y={HEIGHT - 6} textAnchor="middle">
                Now
              </text>
            </g>
          )}
          {points.length > 1 && (
            <path
              d={path}
              fill="none"
              stroke={seriesColor(slot)}
              strokeWidth={2}
              strokeDasharray={seriesDash(slot)}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}
          {(points.length <= 24 ? points : [latest]).map((p, i) => (
            <circle key={i} cx={x(p.t)} cy={y(p.value)} r={3} fill={seriesColor(slot)} stroke="var(--gn-surface)" strokeWidth={1.5} />
          ))}
          {hover && (
            <g pointerEvents="none">
              <line x1={hoverX} x2={hoverX} y1={margin.top} y2={margin.top + plotH} stroke="var(--gn-axis)" strokeWidth={1} />
              <circle cx={hoverX} cy={y(hover.value)} r={4.5} fill={seriesColor(slot)} stroke="var(--gn-surface)" strokeWidth={2} />
            </g>
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
      )}
      {hover && (
        <div className="gn-tooltip" style={{ left: tooltipLeft, top: 28, maxWidth: TOOLTIP_W }}>
          <div className="gn-tooltip-title">{TOOLTIP_DATE.format(hover.t)}</div>
          <div className="gn-tooltip-row">
            <span className="gn-num">
              {FULL.format(hover.value)}
              {suffix}
            </span>
          </div>
          {hover.source && hover.source !== "web" && <div className="gn-tooltip-title mb-0">via {SOURCE_LABELS[hover.source]}</div>}
        </div>
      )}
    </div>
  );
}

export default ValueLineChart;
