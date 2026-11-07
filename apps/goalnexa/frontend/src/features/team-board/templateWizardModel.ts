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
  snapTo: TargetPer;
  /** The moment of a `snapTo` frequency (`snap_weekday`, `snap_time`...), as the schema's fields - sent only with a period. */
  moment: Record<string, unknown>;
}

/** The frequency: a check-in moves to the moment before it ("Any time", "Weekly"...), in the UI language. */
export function snapToLabel(per: TargetPer): string {
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
  targetPer: "", countDays: "all", progressBy: "total", snapTo: "", moment: {},
});
export const newGoal = (title = ""): DraftGoal => ({ key: nextKey++, title, metrics: [newMetric()] });

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
    if (!goals[0].title.trim()) return translate(messages, "errMainGoal");
    if (goals.slice(1).some((g) => !g.title.trim())) return translate(messages, "errSubGoals");
  }
  if (name === "Metrics") {
    const metrics = goals.flatMap((g) => g.metrics);
    if (metrics.length === 0) return translate(messages, "errNoMetrics");
    if (metrics.some((m) => !m.name.trim())) return translate(messages, "errMetricNames");
    if (metrics.some((m) => !isNumber(m.base))) return translate(messages, "errStart");
    if (metrics.some((m) => m.target.trim() !== "" && !isNumber(m.target))) return translate(messages, "errTarget");
    if (metrics.some((m) => m.target.trim() !== "" && Number(m.target) === Number(m.base)))
      return translate(messages, "errTargetEqualsStart");
  }
  return null;
}
