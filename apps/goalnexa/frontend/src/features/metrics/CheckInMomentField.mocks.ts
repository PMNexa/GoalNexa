/**
 * The form fields CheckInMomentField gets from a metric's schema
 * (`snap_to` and its `with` fields, the `SnapMoment` ones) - as
 * platform-core's `createSchemaFields` builds them from the backend's
 * choices (`goalnexa/models/goal.py`).
 */
import type { CrudField } from "platform-core";

type Values = Record<string, unknown>;
type Field = CrudField<Values>;

const opts = (pairs: [string | number, string][]) => pairs.map(([value, label]) => ({ value: String(value), label }));

export const snapToField: Field = {
  key: "snap_to",
  label: "Check-ins are for",
  type: "select",
  helpText: "A check-in for a period is stamped at its moment, whenever it's sent.",
  defaultValue: "goal",
  options: opts([
    ["goal", "Same as goal"],
    ["", "Any time"],
    ["day", "A day"],
    ["week", "A week"],
    ["month", "A month"],
    ["quarter", "A quarter"],
    ["year", "A year"],
  ]),
};

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

/** The moment fields, by key - what the layout's `with` passes. */
export const momentFields: Partial<Record<string, Field>> = {
  snap_weekday: { key: "snap_weekday", label: "Day of the week", type: "select", defaultValue: "1", options: opts(WEEKDAYS.map((d, i) => [i + 1, d])) },
  snap_quarter_month: {
    key: "snap_quarter_month",
    label: "Month of the quarter",
    type: "select",
    defaultValue: "1",
    options: opts([
      [1, "1st month (Jan, Apr, Jul, Oct)"],
      [2, "2nd month (Feb, May, Aug, Nov)"],
      [3, "3rd month (Mar, Jun, Sep, Dec)"],
    ]),
  },
  snap_month: { key: "snap_month", label: "Month", type: "select", defaultValue: "1", options: opts(MONTHS.map((m, i) => [i + 1, m])) },
  snap_day: { key: "snap_day", label: "Day of the month", type: "number" },
  snap_time: { key: "snap_time", label: "Time", type: "select", defaultValue: "00:00", options: opts(TIMES.map((t) => [t, t])) },
  snap_due: { key: "snap_due", label: "Due at that moment", type: "checkbox" },
};
