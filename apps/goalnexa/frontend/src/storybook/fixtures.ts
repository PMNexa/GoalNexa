/**
 * Sample data for stories: one organization ("Acme") with two goals (one
 * with a sub-goal), their metrics and a few weeks of check-ins, a cycle,
 * teams and people. Times are relative to when Storybook loads, so charts
 * always end "now". Stories take these as they are or spread and change
 * one field (`{ ...goals[0], health: "off_track" }`).
 */
import type { CheckIn } from "../api/checkIns";
import type { Cycle } from "../api/cycles";
import type { OrgOption, TeamOption } from "../api/dashboard";
import type { Activity, GoalComment } from "../api/feed";
import type { GoalMember, OrgPerson } from "../api/goalMembers";
import type { Goal } from "../api/goals";
import type { Metric } from "../api/metrics";
import type { ReminderSettings } from "../api/reminders";

const DAY = 86_400_000;
const NOW = Date.now();
/** ISO timestamp `days` days ago (negative = in the future). */
export function daysAgo(days: number): string {
  return new Date(NOW - days * DAY).toISOString();
}
/** "YYYY-MM-DD" `days` days ago (negative = in the future). */
export function dateDaysAgo(days: number): string {
  return daysAgo(days).slice(0, 10);
}

export const ME = "01000000-0000-7000-8000-000000000001";
export const ACCESS_TOKEN = "storybook-token";

export const orgs: OrgOption[] = [
  { id: "02000000-0000-7000-8000-000000000001", name: "Acme", my_role: "owner" },
  { id: "02000000-0000-7000-8000-000000000002", name: "Running club", my_role: "member" },
];
const ORG = orgs[0].id;

export const people: OrgPerson[] = [
  { user_id: ME, name: "Alex Nguyen", email: "alex@example.com", is_me: true },
  { user_id: "01000000-0000-7000-8000-000000000002", name: "Bao Tran", email: "bao@example.com", is_me: false },
  { user_id: "01000000-0000-7000-8000-000000000003", name: "Chi Le", email: "chi@example.com", is_me: false },
];

/** Each with its org (`fetchTeams` filters on it). */
export const teams: (TeamOption & { org: string })[] = [
  { id: "03000000-0000-7000-8000-000000000001", name: "Sales", parent: null, org: orgs[0].id },
  { id: "03000000-0000-7000-8000-000000000002", name: "North", parent: "03000000-0000-7000-8000-000000000001", org: orgs[0].id },
  { id: "03000000-0000-7000-8000-000000000003", name: "South", parent: "03000000-0000-7000-8000-000000000001", org: orgs[0].id },
];

export const cycles: Cycle[] = [
  {
    id: "04000000-0000-7000-8000-000000000001",
    name: "Q4 2026",
    owner_id: ME,
    org_id: ORG,
    starts_on: dateDaysAgo(40),
    ends_on: dateDaysAgo(-50),
    status: "active",
    closed_at: null,
    retro: "",
  },
];

function goal(id: number, title: string, extra: Partial<Goal> = {}): Goal {
  return {
    id: `05000000-0000-7000-8000-00000000000${id}`,
    title,
    description: "",
    owner_id: ME,
    org_id: ORG,
    status: "in_progress",
    target_date: dateDaysAgo(-50),
    visibility: "public",
    parent: null,
    position: id,
    progress: "0",
    projected_progress: "0",
    health: "on_track",
    cycle: cycles[0].id,
    team_id: null,
    template_goal: null,
    is_rollup: false,
    ...extra,
  };
}

export const goals: Goal[] = [
  goal(1, "Grow revenue to $100k MRR", { progress: "57.0", projected_progress: "104.0", health: "on_track" }),
  goal(2, "Ship the mobile app", { progress: "40.0", projected_progress: "82.0", health: "at_risk" }),
  goal(3, "Beta with 50 testers", { parent: "05000000-0000-7000-8000-000000000002", progress: "64.0", projected_progress: "70.0", health: "off_track" }),
];

function metric(id: number, goalId: string, name: string, extra: Partial<Metric> = {}): Metric {
  return {
    id: `06000000-0000-7000-8000-00000000000${id}`,
    goal: goalId,
    name,
    description: "",
    unit: "",
    base_value: "0",
    target_value: "100",
    current_value: "0",
    parent: null,
    position: id,
    aggregation: "latest",
    check_in_every: "weekly",
    last_checked_in_at: daysAgo(3),
    check_in_due_at: daysAgo(-4),
    ingest_token_hint: "",
    target_per: "",
    snap_to: "",
    snap_period: "",
    one_per: "",
    ...extra,
  };
}

export const metrics: Metric[] = [
  metric(1, goals[0].id, "MRR", { unit: "$", base_value: "40000", target_value: "100000", current_value: "74200" }),
  metric(2, goals[0].id, "Paying customers", { base_value: "120", target_value: "300", current_value: "212" }),
  metric(3, goals[1].id, "Screens done", { aggregation: "sum", base_value: "0", target_value: "30", current_value: "16", check_in_due_at: daysAgo(1) }),
  metric(4, goals[2].id, "Beta testers", { base_value: "0", target_value: "50", current_value: "32" }),
  metric(5, goals[0].id, "Churn rate", { unit: "%", base_value: "6", target_value: "6", current_value: "5.4" }),
];

/** Weekly check-ins over the last 8 weeks, rising toward each metric's current value. */
export const checkIns: CheckIn[] = metrics.flatMap((m, mi) => {
  const base = Number(m.base_value);
  const current = Number(m.current_value);
  return Array.from({ length: 8 }, (_, week) => {
    const share = (week + 1) / 8;
    const value =
      m.aggregation === "sum" ? Math.round(current / 8) : Math.round((base + (current - base) * share) * 10) / 10;
    return {
      id: `07000000-0000-7000-8000-0000000${String(mi * 10 + week).padStart(5, "0")}`,
      metric: m.id,
      value: String(value),
      note: week === 7 ? "Latest numbers" : "",
      checked_in_at: daysAgo((7 - week) * 7 + 3),
      author_id: week % 3 === 0 ? people[1].user_id : ME,
      source: week % 4 === 0 ? "agent" : "web",
      replaced: false,
    } satisfies CheckIn;
  });
});

export const goalMembers: GoalMember[] = [
  { id: "08000000-0000-7000-8000-000000000001", goal: goals[1].id, user_id: people[1].user_id, created_at: daysAgo(20) },
];

export const activities: Activity[] = [
  { id: "09000000-0000-7000-8000-000000000001", goal: goals[0].id, actor_id: ME, verb: "checked_in", data: { metric_name: "MRR", value: "74200", unit: "$" }, created_at: daysAgo(3) },
  { id: "09000000-0000-7000-8000-000000000002", goal: goals[0].id, actor_id: null, verb: "health_changed", data: { from: "at_risk", to: "on_track" }, created_at: daysAgo(3) },
  { id: "09000000-0000-7000-8000-000000000003", goal: goals[0].id, actor_id: people[1].user_id, verb: "commented", data: { body: "Great week!" }, created_at: daysAgo(2) },
  { id: "09000000-0000-7000-8000-000000000004", goal: goals[0].id, actor_id: ME, verb: "metric_added", data: { metric_name: "Churn rate" }, created_at: daysAgo(30) },
];

export const comments: GoalComment[] = [
  { id: "0a000000-0000-7000-8000-000000000001", goal: goals[0].id, author_id: people[1].user_id, body: "Great week!", check_in: null, created_at: daysAgo(2) },
];

export const reminderSettings: ReminderSettings = {
  enabled: true,
  urls: "tgram://bottoken/ChatID",
  email: true,
  email_available: true,
  push: true,
  push_available: true,
  push_devices: 1,
  digest: "weekly",
  digest_weekday: 0,
  digest_hour: 8,
  timezone: "Asia/Ho_Chi_Minh",
  allowed_schemes: null,
};
