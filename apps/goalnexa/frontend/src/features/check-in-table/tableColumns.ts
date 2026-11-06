/**
 * The check-in table's columns: how check-ins are bucketed (hour, day,
 * week, month), each column's key, end and label, plus the small
 * formatting helpers the table uses. Pure - no React; labels take the
 * UI language (`locale`, from `useLocale()`; the current one if left out).
 */
import { formatDate, formatNumber, formatTime, translator, type Locale } from "platform-core";
import messages from "./messages";

/** Now, as a `datetime-local` value (local time, minutes). */
export function nowLocal(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** What check-ins are grouped by: each column is one hour, day, week (from the chosen weekday) or month. */
export type Snap = "hour" | "day" | "week" | "month";
export const SNAPS: Snap[] = ["hour", "day", "week", "month"];

/** A weekday's name (0 = Sunday) in the UI language. */
export function weekdayName(day: number, locale?: Locale): string {
  // 2026-01-04 was a Sunday.
  return formatDate(new Date(2026, 0, 4 + day), { weekday: "long" }, locale);
}

/** The first day of the week (per `weekStart`, 0 = Sunday) that `date` ("YYYY-MM-DD") falls in. */
export function weekStartOf(date: string, weekStart: number): string {
  const d = new Date(`${date}T00:00`);
  d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  return dateKey(d);
}

const two = (n: number) => String(n).padStart(2, "0");
const dateKey = (d: Date) =>
  `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`;

/** The column a moment falls in: a sortable key (hour `2026-10-09T13`, day/week `2026-10-09` (the day a week starts), month `2026-10`). */
export function bucketKey(t: number, snap: Snap, weekStart: number): string {
  const d = new Date(t);
  if (snap === "hour") return `${dateKey(d)}T${two(d.getHours())}`;
  if (snap === "month") return `${d.getFullYear()}-${two(d.getMonth() + 1)}`;
  if (snap === "week")
    d.setDate(d.getDate() - ((d.getDay() - weekStart + 7) % 7));
  return dateKey(d);
}

/** The last instant of a column. */
export function bucketEnd(key: string, snap: Snap): number {
  if (snap === "hour") return new Date(`${key}:59:59.999`).getTime();
  if (snap === "month") {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m, 0, 23, 59, 59, 999).getTime();
  }
  const end = new Date(`${key}T23:59:59.999`);
  if (snap === "week") end.setDate(end.getDate() + 6);
  return end.getTime();
}

export function bucketLabel(key: string, snap: Snap, locale?: Locale): string {
  const t = translator(messages, locale);
  const thisYear = new Date().getFullYear();
  if (snap === "month") {
    const d = new Date(`${key}-01T00:00`);
    return formatDate(
      d,
      d.getFullYear() === thisYear
        ? { month: "long" }
        : { month: "short", year: "numeric" },
      locale,
    );
  }
  const d = new Date(snap === "hour" ? `${key}:00` : `${key}T00:00`);
  const date = formatDate(
    d,
    d.getFullYear() === thisYear
      ? { month: "short", day: "numeric" }
      : { year: "numeric", month: "short", day: "numeric" },
    locale,
  );
  if (snap === "hour")
    return t("hourOf", { date, time: formatTime(d, { hour: "numeric" }, locale) });
  return snap === "week" ? t("weekOf", { date }) : date;
}

export const fmt = (n: number, locale?: Locale) =>
  formatNumber(n, { maximumFractionDigits: 2 }, locale);
