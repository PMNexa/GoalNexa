/** Cycles and goal scores for CyclePanel's stories. */
import type { Cycle, GoalScore } from "../../api/cycles";
import type { Goal } from "../../api/goals";
import { cycles, dateDaysAgo, daysAgo, goals } from "../../storybook/fixtures";

export const activeCycle: Cycle = cycles[0];

/** The next one, already planned - what the roll-over select offers. */
export const plannedCycle: Cycle = {
  ...activeCycle,
  id: "04000000-0000-7000-8000-000000000002",
  name: "Q1 2027",
  starts_on: dateDaysAgo(-51),
  ends_on: dateDaysAgo(-141),
  status: "planning",
};

/** The one before, closed. */
export const closedCycle: Cycle = {
  ...activeCycle,
  id: "04000000-0000-7000-8000-000000000003",
  name: "Q3 2026",
  starts_on: dateDaysAgo(132),
  ends_on: dateDaysAgo(41),
  status: "closed",
  closed_at: daysAgo(40),
  retro: "Shipped the beta late; sales held up.",
};

function goal(n: number, title: string, extra: Partial<Goal>): Goal {
  return { ...goals[0], id: `05000000-0000-7000-8000-0000000001${n}`, title, cycle: closedCycle.id, ...extra };
}

/** The closed cycle's goals, now completed / archived / rolled over. */
export const scoredGoals: Goal[] = [
  goal(1, "Reach $70k MRR", { status: "completed", progress: "92.0" }),
  goal(2, "Launch the beta", { status: "completed", progress: "48.0" }),
  goal(3, "Hire two engineers", { status: "completed", progress: "0" }),
  goal(4, "Rebrand the website", { status: "archived", progress: "15.0" }),
];

function score(n: number, extra: Partial<GoalScore>): GoalScore {
  return {
    id: `0c000000-0000-7000-8000-00000000000${n}`,
    goal: scoredGoals[n - 1].id,
    cycle: closedCycle.id,
    score: "0.00",
    outcome: "missed",
    final_progress: null,
    final_health: "off_track",
    reflection: "",
    rolled_to: null,
    created_at: daysAgo(40),
    ...extra,
  };
}

export const goalScores: GoalScore[] = [
  score(1, { score: "0.92", outcome: "achieved", final_progress: "92.0", final_health: "on_track", reflection: "Annual plans did it." }),
  score(2, { score: "0.48", outcome: "partial", final_progress: "48.0", final_health: "at_risk", reflection: "Two weeks late.", rolled_to: goals[2].id }),
  score(3, { score: "0.00", outcome: "missed", final_progress: "0", reflection: "No budget until Q4." }),
  score(4, { score: "0.15", outcome: "dropped", final_progress: "15.0", final_health: "unknown" }),
];
