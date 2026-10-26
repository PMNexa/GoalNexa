/**
 * The onboarding wizard's drafts (nothing is saved until the last step),
 * its steps and the checks run before moving on.
 */

export interface MetricDraft {
  key: number;
  name: string;
  description: string;
  unit: string;
  base: string;
  target: string;
}

export interface GoalDraft {
  key: number;
  title: string;
  description: string;
  targetDate: string;
  metrics: MetricDraft[];
}

/** The website path's steps (after "Get started", the choice between website and agent). */
export const STEPS = ["Organization", "Goals", "Metrics", "Review"] as const;
/** The AI-agent path's steps: connect it, give it the skills, first prompts. */
export const AGENT_STEPS = ["Connect", "Skills", "Try it"] as const;

export type Mode = "web" | "agent";

let nextKey = 1;
export const newMetric = (): MetricDraft => ({ key: nextKey++, name: "", description: "", unit: "", base: "0", target: "" });
export const newGoal = (): GoalDraft => ({ key: nextKey++, title: "", description: "", targetDate: "", metrics: [newMetric()] });

export type Created = { org: string | null; goals: Map<number, string>; metrics: Set<number> };
export const emptyCreated = (): Created => ({ org: null, goals: new Map(), metrics: new Set() });

/** Why a metric can't be saved yet, or `null`. Progress divides by `target - base`, so they must differ. */
export function metricProblem(metric: MetricDraft): string | null {
  if (!metric.name.trim()) return "Every metric needs a name.";
  if (metric.target.trim() === "" || Number.isNaN(Number(metric.target))) return `"${metric.name}" needs a target.`;
  if (Number.isNaN(Number(metric.base || "0"))) return `"${metric.name}" has an invalid start value.`;
  if (Number(metric.target) === Number(metric.base || "0")) return `"${metric.name}": the target must differ from the start value.`;
  return null;
}

export function stepProblem(step: number, orgName: string, goals: GoalDraft[]): string | null {
  if (step === 0) return orgName.trim() ? null : "Give your organization a name.";
  if (step === 1) {
    if (goals.length === 0) return "Add at least one goal.";
    return goals.every((goal) => goal.title.trim()) ? null : "Every goal needs a title.";
  }
  if (step === 2) {
    for (const goal of goals) {
      if (goal.metrics.length === 0) return `"${goal.title}" needs at least one metric.`;
      for (const metric of goal.metrics) {
        const problem = metricProblem(metric);
        if (problem) return problem;
      }
    }
  }
  return null;
}

export function formatAmount(value: string): string {
  return Number(value || "0").toLocaleString(undefined, { maximumFractionDigits: 2 });
}
