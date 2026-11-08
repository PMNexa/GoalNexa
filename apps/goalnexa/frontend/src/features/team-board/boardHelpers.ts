/**
 * The team board's pure helpers: its modes and remembered settings, period
 * math for "Over time" and "Checked in at", and how a cell's numbers read.
 */
import type { KeyboardEvent } from "react";
import type { Cycle } from "../../api/cycles";
import type { BoardMetric, CellNumbers, ShownNumbers } from "../../api/teamBoard";
import { formatDateTime, formatNumber, translate } from "platform-core";
import { midPeriod, momentLabel, nextPeriodStart, periodLabel, periodStart, type Snap } from "../../lib/periods";
import messages from "./messages";

/** A template goal or metric opened from a column header, to edit. */
export interface EditTarget {
  endpoint: "/api/v1/template-goals" | "/api/v1/template-metrics";
  id: string;
}

export type Mode = "checkin" | "targets" | "history";
/** The Mode switch's options, in the UI language. */
export function modeOptions(): { value: Mode; label: string }[] {
  return (["checkin", "targets", "history"] as const).map((value) => ({ value, label: translate(messages, `mode_${value}`) }));
}
/** Check in and Over time show the board as a table or as charts (remembered per browser). */
export type View = "table" | "chart";
/** The View switch's options, in the UI language. */
export function viewOptions(): { value: View; label: string }[] {
  return (["table", "chart"] as const).map((value) => ({ value, label: translate(messages, `view_${value}`) }));
}
export const VIEW_KEY = "goalnexa:board-view";

/** "Over time" cells: each period's value, or its change from the period before. */
export type HistoryShow = "value" | "change";
export const HISTORY_SHOW_KEY = "goalnexa:board-history-show";
/** The Value / Change switch's options, in the UI language. */
export function historyShowOptions(): { value: HistoryShow; label: string }[] {
  return (["value", "change"] as const).map((value) => ({ value, label: translate(messages, `historyShow_${value}`) }));
}

/**
 * A period's change from the one before: its value minus the latest earlier
 * period that has one (an amount: what was done in each; a reading: its last
 * value in each). Null without a value now or before.
 */
export function periodChange(history: (ShownNumbers | null)[], index: number): number | null {
  const now = history[index]?.value;
  if (now === null || now === undefined) return null;
  for (let i = index - 1; i >= 0; i -= 1) {
    const before = history[i]?.value;
    if (before !== null && before !== undefined) return Math.round((now - before) * 100) / 100;
  }
  return null;
}

/** "+5", "−2", "0" - a change, signed, in the UI language. */
export function fmtChange(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  if (value === 0) return fmt(0);
  return `${value > 0 ? "+" : "−"}${fmt(Math.abs(value))}`;
}
/** "Over time": how many periods it shows, up to the picked day. */
export const HISTORY_COUNT: Record<Snap, number> = { day: 14, week: 12, month: 12, quarter: 8, year: 5 };
/** The most periods Over time asks for (the API's cap). */
export const MAX_HISTORY = 60;

/** The first day of the period `count` periods before the one starting at `start`. */
export function periodsBack(start: number, per: Snap, count: number): number {
  let at = start;
  for (let i = 0; i < count; i += 1) at = periodStart(at - 1, per);
  return at;
}

/** How many periods from the one starting at `from` to the one at `to`, both in (stops past MAX_HISTORY). */
export function periodsBetween(from: number, to: number, per: Snap): number {
  let count = 1;
  for (let at = from; at < to && count <= MAX_HISTORY; count += 1) at = nextPeriodStart(at, per);
  return count;
}
export const NO_CYCLE = "none";
/** Org id -> the template last opened there. */
export const TEMPLATE_KEY = "goalnexa:board-template";
/** The bottom of the app's sticky top bar(s) - where the board's header row stops when the page scrolls. */
export function stickyTop(): number {
  let bottom = 0;
  for (const bar of document.querySelectorAll<HTMLElement>(".sticky-top")) {
    const rect = bar.getBoundingClientRect();
    // A bar across the top - not the desktop sidebar, which is sticky too.
    if (rect.height > 0 && rect.top <= 1 && rect.width >= window.innerWidth / 2) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

/** The board's "Show by" period ("" = running totals), remembered per browser. */
export const SHOW_KEY = "goalnexa:board-show";
export const PICKERS_KEY = "goalnexa:board-pickers-folded";

/** A number in the UI language (up to 2 decimals); "—" for none. */
export function fmt(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : formatNumber(value, { maximumFractionDigits: 2 });
}

export function heat(progress: number | null | undefined): string {
  if (progress === null || progress === undefined) return "";
  if (progress >= 100) return "gn-h-done";
  if (progress >= 70) return "gn-h-good";
  if (progress >= 40) return "gn-h-mid";
  return "gn-h-low";
}

/** "Week of Oct 6", or - a metric's own period opening at its moment - "Week from Fri, Oct 2, 17:00". */
export function shownLabel(shown: ShownNumbers, per: Snap): string {
  if (shown.opens) return momentLabel(Date.parse(shown.opens), per);
  const [year, month, day] = shown.start.split("-").map(Number);
  return periodLabel(new Date(year, month - 1, day).getTime(), per);
}

/** A shown cell's %: against the period's target, or - a reading with a target for the whole goal - from base to target. */
export function shownPct(shown: ShownNumbers, numbers: CellNumbers, metric: BoardMetric): number | null {
  if (shown.value === null) return null;
  if (shown.quota) return (shown.value / shown.quota) * 100;
  if (metric.aggregation === "latest" && !numbers.target_per && numbers.target_value !== numbers.base_value) {
    return Math.max(0, ((shown.value - numbers.base_value) / (numbers.target_value - numbers.base_value)) * 100);
  }
  return null;
}

const PERIODS = ["day", "week", "month", "quarter", "year"] as const;
const isPeriod = (per: string): per is Snap => (PERIODS as readonly string[]).includes(per);

/** "today", "this week"... - "total today", the board's placeholder for a metric with one reading per period. */
export function onePerWords(per: string): string {
  return isPeriod(per) ? translate(messages, `onePer_${per}`) : per;
}

/** "per day", "per week"... */
export function perLabel(per: string): string {
  return isPeriod(per) ? translate(messages, `per_${per}`) : per;
}

/** "Today 6/10" for a target per period, or why there's no target right now. */
export function periodLine(numbers: CellNumbers): string | null {
  if (!numbers.target_per) return null;
  const pace = numbers.pace;
  if (!pace || pace.in_period === false) return translate(messages, "noTargetThisPeriod");
  const label = (pace.period_label ?? "").replace(/^./, (c) => c.toUpperCase());
  return `${label} ${fmt(pace.done)}/${fmt(pace.quota)}`;
}

/** Under a period line: the hit rate and streak, or the total against every period's target. */
export function periodSummary(numbers: CellNumbers, progressBy: string): string {
  if (progressBy === "hit_rate") {
    const rate = numbers.hit_rate === null ? "—" : `${Math.round(numbers.hit_rate)}%`;
    const streak = numbers.streak ? translate(messages, "inARow", { n: fmt(numbers.streak) }) : "";
    return `${translate(messages, "hitRate", { rate })}${streak}`;
  }
  return translate(messages, "totalSummary", { current: fmt(numbers.current_value), target: fmt(numbers.cumulative_target) });
}

/** A running total's pace: what's needed per day (or week) to land on target. */
export function paceLine(numbers: CellNumbers): string | null {
  const pace = numbers.pace;
  if (!pace || numbers.target_per || pace.per_day === undefined) return null;
  return pace.per_week !== undefined
    ? translate(messages, "pacePerWeek", { n: fmt(pace.per_week) })
    : translate(messages, "pacePerDay", { n: fmt(pace.per_day) });
}

/** Now, as a `datetime-local` value (local time, minutes). */
/** `t` as a `datetime-local` value ("YYYY-MM-DDTHH:mm", local time). */
export function localInput(t: number): string {
  const d = new Date(t);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function nowLocal(): string {
  return localInput(Date.now());
}

/** "Checked in at" for the period starting at `start`: now in the current one, else its middle (see `midPeriod`). */
export function whenFor(start: number, per: Snap): string {
  return start === periodStart(Date.now(), per) ? nowLocal() : localInput(midPeriod(start, per));
}

const SNAP_RANK: Record<string, number> = { day: 0, week: 1, month: 2, quarter: 3, year: 4 };

/**
 * Whether an "Over time" cell can be set by one check-in: not when the
 * metric keeps one reading per a different period (the new one would
 * replace another), or snaps check-ins to a longer one (it would land
 * outside the cell).
 */
export function periodEditable(metric: BoardMetric, per: Snap): boolean {
  if (metric.one_per && metric.one_per !== per && metric.aggregation === "sum") return false;
  return !metric.snap_to || SNAP_RANK[metric.snap_to] <= SNAP_RANK[per];
}

/** When a check-in that sets an "Over time" cell is made: now in the current period, else inside it - a reading at its end, so it's the period's last. */
export function periodCheckInAt(cell: ShownNumbers, per: Snap, reading: boolean): string {
  if (cell.opens && cell.closes) {
    // The metric's own period (P-93), from the server - exact in the organization's zone.
    const opens = Date.parse(cell.opens);
    const closes = Date.parse(cell.closes);
    const now = Date.now();
    if (opens <= now && now < closes) return new Date(now).toISOString();
    return new Date(reading ? closes - 60_000 : opens + (closes - opens) / 2).toISOString();
  }
  const [y, m, d] = cell.start.split("-").map(Number);
  const start = new Date(y, m - 1, d).getTime();
  if (start === periodStart(Date.now(), per)) return new Date().toISOString();
  if (reading) {
    const [ly, lm, ld] = cell.last.split("-").map(Number);
    return new Date(ly, lm - 1, ld, 23, 59).toISOString();
  }
  return new Date(midPeriod(start, per)).toISOString();
}

/** "Oct 6, 3:05 PM" - an Over time cell's last check-in, in the UI language. */
export function tipTime(value: Date | number | string): string {
  return formatDateTime(value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
/** "Oct 6", in the UI language. */
export function tipDay(value: Date | number | string): string {
  return formatDateTime(value, { month: "short", day: "numeric" });
}

function today(): string {
  return nowLocal().slice(0, 10);
}

/** The cycle running today, else the latest one not closed, else none. */
export function defaultCycle(cycles: Cycle[]): string {
  const day = today();
  const running = cycles.find((c) => c.status !== "closed" && c.starts_on <= day && day <= c.ends_on);
  return (running ?? cycles.find((c) => c.status !== "closed"))?.id ?? NO_CYCLE;
}

export const isNumber = (value: string) => value.trim() !== "" && Number.isFinite(Number(value));

/** A "Last update" on the board's day: just its time. */
export function updateTime(value: Date | number | string): string {
  return formatDateTime(value, { hour: "numeric", minute: "2-digit" });
}
/** A "Last update" on another day: day and time. */
export function updateDate(value: Date | number | string): string {
  return formatDateTime(value, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Enter moves down the column, like a spreadsheet. */
export function onCellKey(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const column = event.currentTarget.dataset.col;
  const inputs = [...document.querySelectorAll<HTMLInputElement>(`.gn-board input[data-col="${column}"]`)];
  const next = inputs[inputs.indexOf(event.currentTarget) + 1];
  next?.focus();
}
