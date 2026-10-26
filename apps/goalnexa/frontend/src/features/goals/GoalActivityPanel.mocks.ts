/** A goal's feed with every kind of entry, for GoalActivityPanel's stories. */
import type { Activity, GoalComment } from "../../api/feed";
import { daysAgo, goals, ME, people } from "../../storybook/fixtures";

const GOAL = goals[0].id;
const BAO = people[1].user_id;

let n = 0;
function activity(verb: Activity["verb"], actor: string | null, hoursAgo: number, data: Record<string, unknown> = {}): Activity {
  n += 1;
  return {
    id: `09000000-0000-7000-8000-0000000001${String(n).padStart(2, "0")}`,
    goal: GOAL,
    actor_id: actor,
    verb,
    data,
    created_at: daysAgo(hoursAgo / 24),
  };
}

/** Newest first, as the API sends them - one of each verb, and the check-in variants. */
export const feedActivities: Activity[] = [
  activity("checked_in", ME, 0.2, { metric_name: "MRR", value: "74200", unit: "$", source: "web" }),
  activity("checked_in", BAO, 2, { metric_name: "Paying customers", value: "212", source: "agent" }),
  activity("checked_in", null, 5, { metric_name: "Paying customers", value: "209" }),
  activity("checked_in", ME, 9, { metric_name: "Screens done", value: "2", adds: true, source: "mobile" }),
  activity("checked_in", ME, 20, { metric_name: "Daily steps", value: "10500", replaces: "8000" }),
  activity("checked_in", BAO, 30, { metric_name: "Daily steps", value: "6000", replaced: true }),
  activity("check_in_changed", ME, 40, { metric_name: "MRR", value: "71000", unit: "$" }),
  activity("check_in_removed", BAO, 50, { metric_name: "MRR", value: "700000", unit: "$" }),
  activity("health_changed", null, 60, { from: "at_risk", to: "on_track" }),
  activity("metric_changed", ME, 80, {
    metric_name: "Paying customers",
    changes: { target_value: ["250", "300"], check_in_every: ["", "weekly"], snap_to: ["", "week"] },
  }),
  activity("goal_changed", ME, 100, { changes: { target_date: ["2026-11-30", "2026-12-15"], visibility: ["private", "public"] } }),
  activity("metric_removed", BAO, 120, { metric_name: "Website visits" }),
  activity("metric_added", ME, 140, { metric_name: "Churn rate" }),
  activity("scored", null, 200, { score: "0.70", outcome: "achieved", cycle: "Q3 2026", rolled_to: GOAL }),
  activity("goal_created", ME, 210, { rolled_from: goals[1].id, cycle: "Q4 2026" }),
  activity("goal_created", ME, 2200),
  // Comments come from goal-comments; this row is skipped.
  activity("commented", BAO, 3, { body: "Great week!" }),
];

export const feedComments: GoalComment[] = [
  { id: "0a000000-0000-7000-8000-000000000101", goal: GOAL, author_id: BAO, body: "Great week!\nThe new pricing page is working.", check_in: null, created_at: daysAgo(3 / 24) },
  { id: "0a000000-0000-7000-8000-000000000102", goal: GOAL, author_id: ME, body: "Thanks - next up: annual plans.", check_in: null, created_at: daysAgo(1 / 24) },
];
