import { formatDate, translator, type Locale } from "platform-core";
import type { CheckIn } from "../api/checkIns";
import type { Metric, TargetPer } from "../api/metrics";
import type { ProgressPoint, ValuePoint } from "./progress";
import messages from "./periods.messages";

/**
 * Periods on the client (the backend's `goalnexa.periods` keeps the stored
 * numbers): bucketing check-ins into days/weeks/months/quarters/years for
 * the dashboard's bars, and "snapping" a series to its last reading per
 * period. Counted in the browser's time zone - close enough for drawing;
 * the server's numbers use the organization's.
 */
export type Snap = Exclude<TargetPer, "">;

const SNAPS: Snap[] = ["day", "week", "month", "quarter", "year"];

/** A period kind's name ("Week"), in `locale` (default: the UI language). */
export function snapLabel(per: Snap, locale?: Locale): string {
  return translator(messages, locale)(`snap_${per}`);
}

/**
 * The period kinds (in order) and their names, in the UI language at the
 * time each is read - inside a component prefer `snapLabel(per, useLocale())`,
 * which re-renders on a switch.
 */
export const SNAP_LABELS: Record<Snap, string> = Object.defineProperties(
  {} as Record<Snap, string>,
  Object.fromEntries(SNAPS.map((per) => [per, { get: () => snapLabel(per), enumerable: true }])),
);

/** Local midnight of the first day of `t`'s period, epoch ms. */
export function periodStart(t: number, per: Snap): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  if (per === "week") d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  else if (per === "month") d.setDate(1);
  else if (per === "quarter") d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  else if (per === "year") d.setMonth(0, 1);
  return d.getTime();
}

export function nextPeriodStart(start: number, per: Snap): number {
  const d = new Date(start);
  if (per === "day") d.setDate(d.getDate() + 1);
  else if (per === "week") d.setDate(d.getDate() + 7);
  else if (per === "month") d.setMonth(d.getMonth() + 1);
  else if (per === "quarter") d.setMonth(d.getMonth() + 3);
  else d.setFullYear(d.getFullYear() + 1);
  return d.getTime();
}

const LABELS: Record<Snap, Intl.DateTimeFormatOptions> = {
  day: { month: "short", day: "numeric" },
  week: { month: "short", day: "numeric" },
  month: { month: "short", year: "numeric" },
  quarter: { month: "short", year: "numeric" },
  year: { year: "numeric" },
};

/** "Oct 5", "Week of Oct 5", "Oct 2026", "Q3 2026", "2026" - in `locale` (default: the UI language). */
export function periodLabel(start: number, per: Snap, locale?: Locale): string {
  const t = translator(messages, locale);
  const date = new Date(start);
  if (per === "quarter") return t("quarter", { q: Math.floor(date.getMonth() / 3) + 1, year: date.getFullYear() });
  const text = formatDate(date, LABELS[per], t.locale);
  return per === "week" ? t("weekOf", { date: text }) : text;
}

const RANK: Record<Snap, number> = { day: 1, week: 2, month: 3, quarter: 4, year: 5 };

/**
 * The period whose last check-in is the one that counts: its one reading
 * per period, else - for a new value - its check-in period (they share the
 * period's moment, so the one saved last wins). An amount adds up: null.
 */
export function countedPer(metric: Metric): Snap | null {
  return (metric.one_per || (metric.aggregation !== "sum" && metric.snap_period) || null) as Snap | null;
}

/**
 * The period a metric's series is snapped to: the dashboard's "Show
 * check-ins by", but never finer than the metric's own one reading per
 * period or its check-in period (a coarser pick still wins) - their
 * check-ins share one moment, so they'd stack on one spot. Null = every check-in.
 */
export function metricSnap(snap: Snap | null, metric: Metric): Snap | null {
  const own = (metric.one_per || metric.snap_period || null) as Snap | null;
  if (!own) return snap;
  if (!snap) return own;
  return RANK[snap] >= RANK[own] ? snap : own;
}

/** Keeps the last point of each period (a reading "as of" the period's end). */
export function snapSeries<T extends ValuePoint | ProgressPoint>(points: T[], per: Snap): T[] {
  const last = new Map<number, T>();
  for (const point of points) last.set(periodStart(point.t, per), point);
  return [...last.values()];
}

/**
 * A moment in the middle of the period starting at `start` (local) - what a
 * form sends for "a check-in for this period", so the server's snap (in the
 * organization's zone, which may differ from the browser's) still lands in it.
 */
export function midPeriod(start: number, per: Snap): number {
  return start + (nextPeriodStart(start, per) - start) / 2;
}

/** The `count` latest periods up to the one around `now`, newest first. */
export function recentPeriods(per: Snap, now: number, count = 12, locale?: Locale): { start: number; label: string }[] {
  const periods: { start: number; label: string }[] = [];
  let start = periodStart(now, per);
  for (let i = 0; i < count; i += 1) {
    periods.push({ start, label: periodLabel(start, per, locale) });
    start = periodStart(start - 1, per);
  }
  return periods;
}

export interface PeriodBar {
  start: number;
  label: string;
  value: number;
}

/**
 * The amount checked in per period for a SUM metric, every period from its
 * first check-in (or `from`) to now - empty periods as 0 - at most `limit`
 * of the latest.
 */
export function periodBars(metric: Metric, checkIns: CheckIn[], per: Snap, now: number, limit = 31, from?: number, locale?: Locale): PeriodBar[] {
  // A weekday target per day has no target on weekends - no bar for them.
  const skipWeekends = per === "day" && metric.target_per === "day" && metric.count_days === "weekdays";
  // A replaced check-in (one reading per period) doesn't count - the server marks it.
  const mine = checkIns.filter((c) => c.metric === metric.id && !c.replaced);
  const sums = new Map<number, number>();
  for (const checkIn of mine) {
    const start = periodStart(Date.parse(checkIn.checked_in_at), per);
    sums.set(start, (sums.get(start) ?? 0) + Number(checkIn.value));
  }
  const first = Math.min(...[...sums.keys(), from ?? Infinity, periodStart(now, per)]);
  const bars: PeriodBar[] = [];
  for (let start = periodStart(first, per); start <= now; start = nextPeriodStart(start, per)) {
    const weekday = new Date(start).getDay();
    if (skipWeekends && (weekday === 0 || weekday === 6)) continue;
    bars.push({ start, label: periodLabel(start, per, locale), value: sums.get(start) ?? 0 });
  }
  return bars.slice(-limit);
}
