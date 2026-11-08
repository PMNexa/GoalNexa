/**
 * The template wizard's drafts (nothing is written before its last step)
 * and the rules each step checks.
 */
import type { TeamOption } from "../../api/dashboard";
import type { RollupRule } from "../../api/teamBoard";
import type { TargetPer } from "../../api/metrics";
import { translate } from "platform-core";
import messages from "./wizardMessages";

export interface DraftMetric {
  key: number;
  name: string;
  unit: string;
  aggregation: "latest" | "sum";
  rollup: RollupRule;
  base: string;
  target: string;
  targetPer: TargetPer;
  countDays: "all" | "weekdays";
  progressBy: "total" | "hit_rate";
  /** Its frequency; "goal" (the default) = inherited from its goal. */
  snapTo: Frequency;
  /** The moment of a `snapTo` frequency (`snap_weekday`, `snap_time`...), as the schema's fields - sent only with a period. */
  moment: Record<string, unknown>;
}

/** A frequency as the template API takes it: a period, any time (""), or inherited ("goal" on a metric, "parent" on a sub-goal). */
export type Frequency = TargetPer | "goal" | "parent";

/** A frequency in effect - after inheriting - and its moment. */
export interface Effective {
  snapTo: TargetPer;
  moment: Record<string, unknown>;
}

/** The frequency: a check-in moves to the moment before it ("Any time", "Weekly", "Same as goal"...), in the UI language. */
export function snapToLabel(per: Frequency): string {
  return translate(messages, per ? (`snap_${per}` as const) : "snap_any");
}
export const PER_ORDER: TargetPer[] = ["", "day", "week", "month", "quarter", "year"];
/** A frequency can't be longer than the target's period. */
export const periodFits = (per: TargetPer, targetPer: TargetPer) =>
  !per || !targetPer || PER_ORDER.indexOf(per) <= PER_ORDER.indexOf(targetPer);

/** What a target is for ("The whole goal", "Each day"...), in the UI language. */
export function targetPerLabel(per: TargetPer): string {
  return translate(messages, per ? (`targetPer_${per}` as const) : "targetPer_whole");
}

export interface DraftGoal {
  key: number;
  title: string;
  /** Its frequency; "parent" (a sub-goal's default) = its parent goal's. A top-level goal starts at any time. */
  snapTo: Frequency;
  moment: Record<string, unknown>;
  /** The draft goal it's a sub-goal of (its `key`); null = a top-level goal of the template. */
  parent: number | null;
  metrics: DraftMetric[];
}

export const NO_CYCLE = "none";
export const ROLLUP_RULES: RollupRule[] = ["sum", "avg", "min", "none"];
/** How teams add up ("Add up", "Average"...), in the UI language. */
export function rollupLabel(rule: RollupRule): string {
  return translate(messages, `rollup_${rule}` as const);
}

let nextKey = 1;
export const newMetric = (): DraftMetric => ({
  key: nextKey++, name: "", unit: "", aggregation: "latest", rollup: "sum", base: "0", target: "",
  targetPer: "", countDays: "all", progressBy: "total", snapTo: "goal", moment: {},
});
export const newGoal = (title = "", parent: number | null = null): DraftGoal => ({
  key: nextKey++, title, parent, snapTo: parent === null ? "" : "parent", moment: {}, metrics: [newMetric()],
});

/** `goal`'s frequency in effect: its own, else (inherited) its parent goal's, all the way up; any time at the top. */
export function effectiveGoal(goals: DraftGoal[], goal: DraftGoal | undefined, seen = 0): Effective {
  if (!goal || seen > goals.length) return { snapTo: "", moment: {} };
  if (goal.snapTo === "parent" || goal.snapTo === "goal") {
    return goal.parent === null ? { snapTo: "", moment: {} } : effectiveGoal(goals, goals.find((g) => g.key === goal.parent), seen + 1);
  }
  return { snapTo: goal.snapTo, moment: goal.moment };
}

/** `metric`'s frequency in effect: its own, else its goal's. */
export function effectiveMetric(goals: DraftGoal[], goal: DraftGoal, metric: DraftMetric): Effective {
  return metric.snapTo === "goal" || metric.snapTo === "parent" ? effectiveGoal(goals, goal) : { snapTo: metric.snapTo, moment: metric.moment };
}

/** `goals` with a new sub-goal of `parent` after its last sub-goal (parents stay before their sub-goals). */
export function withSubGoal(goals: DraftGoal[], parent: number): DraftGoal[] {
  let at = goals.findIndex((g) => g.key === parent);
  while (at + 1 < goals.length && goals[at + 1].parent === parent) at += 1;
  return [...goals.slice(0, at + 1), newGoal("", parent), ...goals.slice(at + 1)];
}

/** `goals` without the goal `key` and its sub-goals. */
export const withoutGoal = (goals: DraftGoal[], key: number): DraftGoal[] =>
  goals.filter((g) => g.key !== key && g.parent !== key);

export const isNumber = (value: string) => value.trim() !== "" && Number.isFinite(Number(value));

/** Teams in tree order, with their depth. */
export function teamTree(teams: TeamOption[]): { team: TeamOption; depth: number }[] {
  const known = new Set(teams.map((t) => t.id));
  const children = new Map<string | null, TeamOption[]>();
  for (const team of teams) {
    const key = team.parent && known.has(team.parent) ? team.parent : null;
    children.set(key, [...(children.get(key) ?? []), team]);
  }
  const out: { team: TeamOption; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const team of (children.get(parent) ?? []).sort((a, b) => a.name.localeCompare(b.name))) {
      out.push({ team, depth });
      visit(team.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/** Why the step `name` (a step id: "Template", "Goals", "Metrics"...) can't go on yet, or null - in the UI language. */
export function stepProblem(name: string, title: string, goals: DraftGoal[]): string | null {
  if (name === "Template" && !title.trim()) return translate(messages, "errTemplateName");
  if (name === "Goals") {
    if (goals.some((g) => g.parent === null && !g.title.trim())) return translate(messages, "errMainGoal");
    if (goals.some((g) => g.parent !== null && !g.title.trim())) return translate(messages, "errSubGoals");
  }
  if (name === "Metrics") {
    const metrics = goals.flatMap((g) => g.metrics);
    if (metrics.length === 0) return translate(messages, "errNoMetrics");
    if (metrics.some((m) => !m.name.trim())) return translate(messages, "errMetricNames");
    if (metrics.some((m) => !isNumber(m.base))) return translate(messages, "errStart");
    if (metrics.some((m) => m.target.trim() !== "" && !isNumber(m.target))) return translate(messages, "errTarget");
    if (metrics.some((m) => m.target.trim() !== "" && Number(m.target) === Number(m.base)))
      return translate(messages, "errTargetEqualsStart");
    // An inherited frequency can't be longer than the metric's target period either.
    if (goals.some((g) => g.metrics.some((m) => !periodFits(effectiveMetric(goals, g, m).snapTo, m.targetPer))))
      return translate(messages, "errFrequencyTooLong");
  }
  return null;
}
