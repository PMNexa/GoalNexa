/**
 * The goal tree's inputs as the dashboard derives them
 * (`useDashboardCharts`): the shared fixtures plus a sub-metric, a target
 * per period with its `pace`, and a team's copy of a template goal.
 */
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import { computeGoalProgress, rootMetrics } from "../../lib/progress";
import { checkIns, daysAgo, goals, metrics, teams } from "../../storybook/fixtures";
import type { GoalFilterListProps } from "./GoalFilterList";

/** A team's copy of a template goal (tagged with its team). */
export const teamGoal: Goal = {
  ...goals[0],
  id: "05000000-0000-7000-8000-0000000000f1",
  title: "Hit the quarter's sales",
  position: 9,
  progress: "35.0",
  team_id: teams[1].id,
  template_goal: "0b000000-0000-7000-8000-000000000001",
};

export const treeGoals: Goal[] = [...goals, teamGoal];

export const treeMetrics: Metric[] = [
  ...metrics,
  // A sub-metric breaking MRR down (doesn't count toward the goal's %).
  {
    ...metrics[0],
    id: "06000000-0000-7000-8000-0000000000f1",
    name: "Enterprise MRR",
    parent: metrics[0].id,
    base_value: "10000",
    target_value: "45000",
    current_value: "31800",
    position: 1,
    check_in_due_at: daysAgo(2),
  },
  // A target per period: "6 / 10 /day" from its pace.
  {
    ...metrics[1],
    id: "06000000-0000-7000-8000-0000000000f2",
    goal: teamGoal.id,
    name: "Sales calls with a really long name that truncates",
    aggregation: "sum",
    base_value: "0",
    target_value: "10",
    current_value: "212",
    target_per: "day",
    progress_by: "hit_rate",
    hit_rate: "72",
    pace: { per: "day", in_period: true, period_label: "Today", done: 6, quota: 10, left: 4 },
    position: 1,
  },
];

export const teamNames = new Map(teams.map((t) => [t.id, t.name]));

/** The tree's props for the goals shown (in color-slot order) and the metrics unticked, as the dashboard computes them. */
export function treeProps(shown: string[] = treeGoals.map((g) => g.id), disabled: string[] = []): Omit<GoalFilterListProps, "onToggleGoal" | "onToggleMetric" | "actions"> {
  const metricsByGoal = new Map<string, Metric[]>();
  for (const m of [...treeMetrics].sort((a, b) => a.position - b.position)) metricsByGoal.set(m.goal, [...(metricsByGoal.get(m.goal) ?? []), m]);
  const metricSlot = new Map<string, number>();
  for (const list of metricsByGoal.values()) list.forEach((m, i) => metricSlot.set(m.id, i + 1));
  const disabledMetrics = new Set(disabled);
  const counted = rootMetrics(treeMetrics).filter((m) => !disabledMetrics.has(m.id));
  const currentByGoal = new Map(
    computeGoalProgress(treeGoals.filter((g) => shown.includes(g.id)), counted, checkIns).map((p) => [p.goal.id, p.current]),
  );
  return {
    goals: treeGoals,
    selected: new Map(shown.map((id, i) => [id, i + 1])),
    atLimit: false,
    maxGoals: 8,
    metricsByGoal,
    metricSlot,
    disabledMetrics,
    currentByGoal,
    loading: false,
    now: Date.now(),
    teamNames,
  };
}
