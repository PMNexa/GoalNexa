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
 *
 * A metric with a frequency (P-93) counts in its OWN periods: from one of
 * its moments to the next (`momentStart` - a weekly Friday 17:00 metric's
 * week is Friday 17:00 -> Friday 17:00), the same rule as the server's
 * `periods.period_key`.
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

/** The first moment of the period before the one starting at `start` (local midnight). */
export function prevPeriodStart(start: number, per: Snap): number {
  return periodStart(start - 1, per);
}

/** A goal's, metric's or template row's frequency and its moment (`SnapMoment`). */
export interface MomentSetting {
  /** The frequency in effect (a metric's or goal's API field), if sent. */
  snap_period?: string | null;
  /** The frequency - in effect on a board metric; "goal"/"parent" = inherited elsewhere. */
  snap_to?: string | null;
  snap_weekday?: number;
  snap_quarter_month?: number;
  snap_month?: number;
  snap_day?: number;
  snap_time?: string;
}

/** `row`'s frequency in effect, or null (any time). */
export function frequencyOf(row?: MomentSetting | null): Snap | null {
  if (!row) return null;
  const per = row.snap_period ?? row.snap_to;
  return SNAPS.includes(per as Snap) ? (per as Snap) : null;
}

function onDay(year: number, month: number, day: number): Date {
  const last = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, last));
}

/**
 * `row`'s moment in the calendar period of `per` starting `start` (local
 * midnight): its day and time for its own frequency; a coarser period (or
 * no frequency) opens on its first day, at the frequency's time.
 */
export function momentIn(start: number, per: Snap, row?: MomentSetting | null): number {
  const own = frequencyOf(row);
  const s = new Date(start);
  let d = s;
  if (row && own === per) {
    if (per === "week") d = new Date(s.getFullYear(), s.getMonth(), s.getDate() + (row.snap_weekday ?? 1) - 1);
    else if (per === "month") d = onDay(s.getFullYear(), s.getMonth(), row.snap_day ?? 1);
    else if (per === "quarter") d = onDay(s.getFullYear(), s.getMonth() + (row.snap_quarter_month ?? 1) - 1, row.snap_day ?? 1);
    else if (per === "year") d = onDay(s.getFullYear(), (row.snap_month ?? 1) - 1, row.snap_day ?? 1);
  }
  const [hour, minute] = (own && row?.snap_time ? row.snap_time : "00:00").split(":").map(Number);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), hour, minute).getTime();
}

/** When `row`'s period of `per` that `t` is in opens: the latest moment at or before `t`. */
export function momentStart(t: number, per: Snap, row?: MomentSetting | null): number {
  const start = periodStart(t, per);
  const moment = momentIn(start, per, row);
  return t < moment ? momentIn(prevPeriodStart(start, per), per, row) : moment;
}

/** When the period opening at `opens` (a `momentStart`) closes: the next moment. */
export function nextMomentStart(opens: number, per: Snap, row?: MomentSetting | null): number {
  return momentIn(nextPeriodStart(periodStart(opens, per), per), per, row);
}

/** When the period before the one opening at `opens` opened. */
export function prevMomentStart(opens: number, per: Snap, row?: MomentSetting | null): number {
  return momentIn(prevPeriodStart(periodStart(opens, per), per), per, row);
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

/**
 * A metric's own period opening at `opens`: the calendar name when it opens
 * on the calendar period's first day at midnight ("Week of Oct 5"), else
 * from its moment ("Week from Fri, Oct 2, 17:00").
 */
export function momentLabel(opens: number, per: Snap, locale?: Locale): string {
  if (opens === periodStart(opens, per)) return periodLabel(opens, per, locale);
  const t = translator(messages, locale);
  const date = new Date(opens);
  const withTime = date.getHours() !== 0 || date.getMinutes() !== 0;
  const text = formatDate(date, {
    ...(per === "week" || per === "day" ? { weekday: "short" } : {}),
    month: "short", day: "numeric",
    ...(per === "day" ? {} : { year: per === "year" || per === "quarter" ? "numeric" : undefined }),
    ...(withTime ? { hour: "2-digit", minute: "2-digit", hourCycle: "h23" } : {}),
  } as Intl.DateTimeFormatOptions, t.locale);
  return t(`from_${per}`, { date: text });
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

/** Keeps the last point of each period (a reading "as of" the period's end) - `row`'s own periods. */
export function snapSeries<T extends ValuePoint | ProgressPoint>(points: T[], per: Snap, row?: MomentSetting | null): T[] {
  const last = new Map<number, T>();
  for (const point of points) last.set(momentStart(point.t, per, row), point);
  return [...last.values()];
}

/**
 * A moment in the middle of `row`'s period opening at `start` - what a form
 * sends for "a check-in for this period", so the server's snap (in the
 * organization's zone, which may differ from the browser's) still lands in it.
 */
export function midPeriod(start: number, per: Snap, row?: MomentSetting | null): number {
  return start + (nextMomentStart(start, per, row) - start) / 2;
}

/** The `count` latest of `row`'s periods up to the one running at `now`, newest first (`start` = when each opens). */
export function recentPeriods(per: Snap, now: number, count = 12, locale?: Locale, row?: MomentSetting | null): { start: number; label: string }[] {
  const periods: { start: number; label: string }[] = [];
  let start = momentStart(now, per, row);
  for (let i = 0; i < count; i += 1) {
    periods.push({ start, label: momentLabel(start, per, locale) });
    start = prevMomentStart(start, per, row);
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
  // The metric's own periods (P-93): from one of its moments to the next.
  const sums = new Map<number, number>();
  for (const checkIn of mine) {
    const start = momentStart(Date.parse(checkIn.checked_in_at), per, metric);
    sums.set(start, (sums.get(start) ?? 0) + Number(checkIn.value));
  }
  const first = Math.min(...[...sums.keys(), from ?? Infinity, momentStart(now, per, metric)]);
  const bars: PeriodBar[] = [];
  for (let start = momentStart(first, per, metric); start <= now; start = nextMomentStart(start, per, metric)) {
    const weekday = new Date(start).getDay();
    if (skipWeekends && (weekday === 0 || weekday === 6)) continue;
    bars.push({ start, label: momentLabel(start, per, locale), value: sums.get(start) ?? 0 });
  }
  return bars.slice(-limit);
}
