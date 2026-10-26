/** Metrics and check-ins for the check-in form's period cases. */
import { http, HttpResponse } from "msw";
import type { CheckIn } from "../../api/checkIns";
import type { Metric } from "../../api/metrics";
import { checkIns, metrics } from "../../storybook/fixtures";

const today = new Date();
today.setHours(8, 15, 0, 0);

/** Steps: amounts, one reading per day - a check-in is the day's total so far. */
export const stepsMetric: Metric = {
  ...metrics[2],
  id: "06000000-0000-7000-8000-0000000000a1",
  name: "Steps",
  unit: "steps",
  aggregation: "sum",
  base_value: "0",
  target_value: "300000",
  current_value: "184000",
  one_per: "day",
};

/** Today's earlier check-in on Steps, the one a new one replaces. */
export const stepsToday: CheckIn = {
  ...checkIns[0],
  id: "07000000-0000-7000-8000-0000000a0001",
  metric: stepsMetric.id,
  value: "8000",
  checked_in_at: today.toISOString(),
};

/** Weekly active users: readings for a whole week (`snap_period`), one per week. */
export const wauMetric: Metric = {
  ...metrics[1],
  id: "06000000-0000-7000-8000-0000000000a2",
  name: "Weekly active users",
  base_value: "400",
  target_value: "2000",
  current_value: "1240",
  snap_to: "week",
  snap_period: "week",
  one_per: "week",
};

/**
 * The form's "this period's check-in" lookup (`filter{checked_in_at.lt}`,
 * which the shared handlers don't understand): Steps has one today.
 */
export const periodCheckInHandler = http.get("*/api/v1/check-ins", ({ request }) => {
  const metric = new URL(request.url).searchParams.get("filter{metric}");
  const items = metric === stepsMetric.id ? [stepsToday] : [];
  return HttpResponse.json({ items, total: items.length, page: 1, page_size: 1 });
});
