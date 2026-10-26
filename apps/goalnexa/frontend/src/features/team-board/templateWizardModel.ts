/**
 * The template wizard's drafts (nothing is written before its last step)
 * and the rules each step checks.
 */
import type { TeamOption } from "../../api/dashboard";
import type { RollupRule } from "../../api/teamBoard";
import type { TargetPer } from "../../api/metrics";

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
  onePer: TargetPer;
  snapTo: TargetPer;
}

/** "One reading per": only the last check-in of each period counts. */
export const ONE_PER_LABELS: Record<TargetPer, string> = {
  "": "Every check-in counts",
  day: "Last one each day",
  week: "Last one each week",
  month: "Last one each month",
  quarter: "Last one each quarter",
  year: "Last one each year",
};
/** "Check-ins are for": a check-in's time is snapped to its period. */
export const SNAP_TO_LABELS: Record<TargetPer, string> = {
  "": "Any time",
  day: "A day",
  week: "A week",
  month: "A month",
  quarter: "A quarter",
  year: "A year",
};
export const PER_ORDER: TargetPer[] = ["", "day", "week", "month", "quarter", "year"];
/** One reading per period can't be longer than the target's period. */
export const onePerFits = (onePer: TargetPer, targetPer: TargetPer) =>
  !onePer || !targetPer || PER_ORDER.indexOf(onePer) <= PER_ORDER.indexOf(targetPer);

export const TARGET_PER_LABELS: Record<TargetPer, string> = {
  "": "The whole goal",
  day: "Each day",
  week: "Each week",
  month: "Each month",
  quarter: "Each quarter",
  year: "Each year",
};

export interface DraftGoal {
  key: number;
  title: string;
  metrics: DraftMetric[];
}

export const NO_CYCLE = "none";
export const ROLLUP_LABELS: Record<RollupRule, string> = {
  sum: "Add up",
  avg: "Average",
  min: "Lowest team",
  none: "No total",
};

let nextKey = 1;
export const newMetric = (): DraftMetric => ({
  key: nextKey++, name: "", unit: "", aggregation: "latest", rollup: "sum", base: "0", target: "",
  targetPer: "", countDays: "all", progressBy: "total", onePer: "", snapTo: "",
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

/** Why the step `name` can't go on yet, or null. */
export function stepProblem(name: string, title: string, goals: DraftGoal[]): string | null {
  if (name === "Template" && !title.trim()) return "Give the template a name.";
  if (name === "Goals") {
    if (!goals[0].title.trim()) return "Name the main goal.";
    if (goals.slice(1).some((g) => !g.title.trim())) return "Name every sub-goal, or remove the empty one.";
  }
  if (name === "Metrics") {
    const metrics = goals.flatMap((g) => g.metrics);
    if (metrics.length === 0) return "Add at least one metric.";
    if (metrics.some((m) => !m.name.trim())) return "Name every metric, or remove the empty one.";
    if (metrics.some((m) => !isNumber(m.base))) return "Every start needs a number (0 is fine).";
    if (metrics.some((m) => m.target.trim() !== "" && !isNumber(m.target))) return "A target needs a number - or leave it empty.";
    if (metrics.some((m) => m.target.trim() !== "" && Number(m.target) === Number(m.base)))
      return "A target equal to its start means no target - leave it empty instead.";
  }
  return null;
}
