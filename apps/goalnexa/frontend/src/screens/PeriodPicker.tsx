import { useEffect, useRef, useState } from "react";
import { nextPeriodStart, periodLabel, periodStart, SNAP_LABELS, type Snap } from "../lib/periods";

export interface PeriodPickerProps {
  id?: string;
  /** The period kind picked by (its tabs change it). */
  per: Snap;
  onPerChange?: (per: Snap) => void;
  /** The kinds offered as tabs (default: all). */
  pers?: Snap[];
  /** Pick a range (two clicks: first and last period) instead of one period. */
  range?: boolean;
  /** The first days of the picked periods; `from` = `to` for one period. */
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
  /** Nothing after this period can be picked (default: now). */
  max?: number;
}

const PERIOD_PICKER_CSS = `.gn-period-picker { position: relative; }
.gn-period-picker .gn-pp-menu { position: absolute; top: calc(100% + .25rem); right: 0; z-index: 30; width: 18rem; padding: .5rem; background: var(--tblr-bg-surface, #fff); border: 1px solid var(--tblr-border-color, #e6e7e9); border-radius: 4px; box-shadow: 0 .5rem 1rem rgba(0, 0, 0, .1); }
.gn-period-picker .gn-pp-tabs { display: flex; gap: 2px; margin-bottom: .5rem; }
.gn-period-picker .gn-pp-tabs button { flex: 1; font-size: .75rem; padding: .2rem 0; border: 1px solid var(--tblr-border-color, #e6e7e9); background: transparent; border-radius: 3px; color: inherit; }
.gn-period-picker .gn-pp-tabs button[aria-pressed="true"] { background: var(--tblr-primary, #066fd1); border-color: var(--tblr-primary, #066fd1); color: #fff; }
.gn-period-picker .gn-pp-nav { display: flex; align-items: center; justify-content: space-between; margin-bottom: .35rem; font-weight: 600; font-size: .85rem; }
.gn-period-picker .gn-pp-nav button { border: 0; background: transparent; padding: 0 .5rem; font-size: 1rem; line-height: 1; color: inherit; }
.gn-period-picker .gn-pp-nav button:disabled { opacity: .3; }
.gn-period-picker .gn-pp-grid { display: grid; gap: 2px; }
.gn-period-picker .gn-pp-days { grid-template-columns: repeat(7, 1fr); }
.gn-period-picker .gn-pp-head { text-align: center; font-size: .7rem; color: var(--tblr-secondary, #667382); padding: .1rem 0; }
.gn-period-picker .gn-pp-cell { border: 0; background: transparent; border-radius: 3px; padding: .3rem 0; font-size: .8rem; color: inherit; font-variant-numeric: tabular-nums; }
.gn-period-picker .gn-pp-cell:hover:not(:disabled) { background: var(--tblr-bg-surface-secondary, #f1f3f6); }
.gn-period-picker .gn-pp-cell:disabled { opacity: .35; }
.gn-period-picker .gn-pp-out { color: var(--tblr-secondary, #667382); }
.gn-period-picker .gn-pp-in { background: color-mix(in srgb, var(--tblr-primary, #066fd1) 14%, transparent); }
.gn-period-picker .gn-pp-end, .gn-period-picker .gn-pp-end:hover:not(:disabled) { background: var(--tblr-primary, #066fd1); color: #fff; }
.gn-period-picker .gn-pp-week { display: contents; }
.gn-period-picker .gn-pp-hint { font-size: .75rem; color: var(--tblr-secondary, #667382); margin-top: .4rem; }
`;

const MONTH = new Intl.DateTimeFormat(undefined, { month: "short" });
const MONTH_YEAR = new Intl.DateTimeFormat(undefined, { month: "long", year: "numeric" });
const WEEKDAY = new Intl.DateTimeFormat(undefined, { weekday: "narrow" });

function addMonths(t: number, months: number): number {
  const d = new Date(t);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  return d.getTime();
}

/** The label of one period or a range of them. */
export function periodRangeLabel(from: number, to: number, per: Snap): string {
  return from === to ? periodLabel(to, per) : `${periodLabel(from, per)} – ${periodLabel(to, per)}`;
}

/**
 * One period or a range of them, picked by day, week, month, quarter or
 * year: a button with the pick, opening a calendar (days and weeks) or a
 * grid of months, quarters or years. Values are periods' first days, local
 * time (`lib/periods.ts`).
 */
function PeriodPicker({ id, per, onPerChange, pers, range, from, to, onChange, max }: PeriodPickerProps) {
  const [open, setOpen] = useState(false);
  // What the grid shows: a month (days, weeks) or a year (months, quarters) or a block of 12 years.
  const [nav, setNav] = useState(to);
  // A range's first click, until the second one.
  const [anchor, setAnchor] = useState<number | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const last = periodStart(max ?? Date.now(), per);
  const kinds = pers ?? (Object.keys(SNAP_LABELS) as Snap[]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function toggle() {
    if (!open) {
      setNav(to);
      setAnchor(null);
    }
    setOpen((v) => !v);
  }

  function pick(start: number) {
    if (!range) {
      onChange(start, start);
      setOpen(false);
      return;
    }
    if (anchor === null) {
      setAnchor(start);
      return;
    }
    onChange(Math.min(anchor, start), Math.max(anchor, start));
    setAnchor(null);
    setOpen(false);
  }

  // What's highlighted: the pending range while picking, else the value.
  const [lo, hi] =
    anchor !== null ? [Math.min(anchor, hover ?? anchor), Math.max(anchor, hover ?? anchor)] : [from, to];
  function cellClass(start: number, extra = "") {
    const end = start === lo || start === hi;
    return `gn-pp-cell${end ? " gn-pp-end" : start > lo && start < hi ? " gn-pp-in" : ""}${extra}`;
  }
  function cell(start: number, text: string, extra = "") {
    return (
      <button
        key={start}
        type="button"
        className={cellClass(start, extra)}
        disabled={start > last}
        onClick={() => pick(start)}
        onMouseEnter={() => setHover(start)}
      >
        {text}
      </button>
    );
  }

  // Navigation: by month for days and weeks, by year for months and quarters, by 12 years for years.
  const monthly = per === "day" || per === "week";
  const navStart = monthly
    ? periodStart(nav, "month")
    : per === "year"
      ? new Date(new Date(nav).getFullYear() - 11, 0, 1).getTime()
      : periodStart(nav, "year");
  const step = (direction: number) =>
    setNav(addMonths(nav, direction * (monthly ? 1 : per === "year" ? 144 : 12)));
  const navTitle = monthly
    ? MONTH_YEAR.format(navStart)
    : per === "year"
      ? `${new Date(navStart).getFullYear()} – ${new Date(nav).getFullYear()}`
      : String(new Date(navStart).getFullYear());
  const nextNav = monthly ? addMonths(navStart, 1) : per === "year" ? nextPeriodStart(periodStart(nav, "year"), "year") : addMonths(navStart, 12);

  function grid() {
    if (monthly) {
      const weeks: number[] = [];
      for (let w = periodStart(navStart, "week"); w < nextNav; w = nextPeriodStart(w, "week")) weeks.push(w);
      return (
        <div className="gn-pp-grid gn-pp-days" onMouseLeave={() => setHover(null)}>
          {Array.from({ length: 7 }, (_, i) => (
            <div key={i} className="gn-pp-head">{WEEKDAY.format(new Date(weeks[0] + i * 86400000 + 43200000))}</div>
          ))}
          {weeks.map((week) => {
            const days: number[] = [];
            for (let d = week, i = 0; i < 7; d = nextPeriodStart(d, "day"), i += 1) days.push(d);
            if (per === "week") {
              // A whole row is one week: each day picks it, highlighted as one.
              return (
                <div key={week} className="gn-pp-week">
                  {days.map((d) => (
                    <button
                      key={d}
                      type="button"
                      className={cellClass(week, d < navStart || d >= nextNav ? " gn-pp-out" : "")}
                      disabled={week > last}
                      onClick={() => pick(week)}
                      onMouseEnter={() => setHover(week)}
                      aria-label={periodLabel(week, "week")}
                    >
                      {new Date(d).getDate()}
                    </button>
                  ))}
                </div>
              );
            }
            return days.map((d) => cell(d, String(new Date(d).getDate()), d < navStart || d >= nextNav ? " gn-pp-out" : ""));
          })}
        </div>
      );
    }
    const starts: number[] = [];
    for (let s = navStart; s < nextNav; s = nextPeriodStart(s, per)) starts.push(s);
    return (
      <div
        className="gn-pp-grid"
        style={{ gridTemplateColumns: `repeat(${per === "quarter" ? 2 : 3}, 1fr)` }}
        onMouseLeave={() => setHover(null)}
      >
        {starts.map((s) =>
          cell(
            s,
            per === "month"
              ? MONTH.format(s)
              : per === "quarter"
                ? `Q${Math.floor(new Date(s).getMonth() / 3) + 1}`
                : String(new Date(s).getFullYear()),
          ),
        )}
      </div>
    );
  }

  return (
    <div className="gn-period-picker" ref={root}>
      <style href="gn-period-picker" precedence="default">
        {PERIOD_PICKER_CSS}
      </style>
      <button
        id={id}
        type="button"
        className="form-select form-select-sm text-start text-truncate"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        {range ? periodRangeLabel(from, to, per) : periodLabel(to, per)}
      </button>
      {open && (
        <div className="gn-pp-menu" role="dialog" aria-label={range ? "Pick a range" : "Pick a period"}>
          {kinds.length > 1 && onPerChange && (
            <div className="gn-pp-tabs">
              {kinds.map((kind) => (
                <button
                  key={kind}
                  type="button"
                  aria-pressed={kind === per}
                  onClick={() => {
                    setAnchor(null);
                    onPerChange(kind);
                  }}
                >
                  {SNAP_LABELS[kind]}
                </button>
              ))}
            </div>
          )}
          <div className="gn-pp-nav">
            <button type="button" aria-label="Earlier" onClick={() => step(-1)}>‹</button>
            <span>{navTitle}</span>
            <button type="button" aria-label="Later" disabled={nextNav > last} onClick={() => step(1)}>›</button>
          </div>
          {grid()}
          <div className="gn-pp-hint">
            {range
              ? anchor === null
                ? "Click the first period, then the last."
                : `From ${periodLabel(anchor, per)} - now click the last.`
              : `Click a ${SNAP_LABELS[per].toLowerCase()}.`}
          </div>
        </div>
      )}
    </div>
  );
}

export default PeriodPicker;
