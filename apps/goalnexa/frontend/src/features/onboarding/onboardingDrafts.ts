import { formatNumber, translate, type Locale } from "platform-core";
import messages from "./messages";

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
export const STEPS = ["organization", "goals", "metrics", "review"] as const;
/** The AI-agent path's steps: connect it, give it the skills, first prompts. */
export const AGENT_STEPS = ["connect", "skills", "try"] as const;

export type Mode = "web" | "agent";

let nextKey = 1;
export const newMetric = (): MetricDraft => ({ key: nextKey++, name: "", description: "", unit: "", base: "0", target: "" });
export const newGoal = (): GoalDraft => ({ key: nextKey++, title: "", description: "", targetDate: "", metrics: [newMetric()] });

export type Created = { org: string | null; goals: Map<number, string>; metrics: Set<number> };
export const emptyCreated = (): Created => ({ org: null, goals: new Map(), metrics: new Set() });

/** Why a metric can't be saved yet (in the UI language), or `null`. Progress divides by `target - base`, so they must differ. */
export function metricProblem(metric: MetricDraft): string | null {
  if (!metric.name.trim()) return translate(messages, "metricNoName");
  if (metric.target.trim() === "" || Number.isNaN(Number(metric.target))) return translate(messages, "metricNoTarget", { name: metric.name });
  if (Number.isNaN(Number(metric.base || "0"))) return translate(messages, "metricBadStart", { name: metric.name });
  if (Number(metric.target) === Number(metric.base || "0")) return translate(messages, "metricSameTarget", { name: metric.name });
  return null;
}

export function stepProblem(step: number, orgName: string, goals: GoalDraft[]): string | null {
  if (step === 0) return orgName.trim() ? null : translate(messages, "orgNoName");
  if (step === 1) {
    if (goals.length === 0) return translate(messages, "noGoals");
    return goals.every((goal) => goal.title.trim()) ? null : translate(messages, "goalNoTitle");
  }
  if (step === 2) {
    for (const goal of goals) {
      if (goal.metrics.length === 0) return translate(messages, "goalNoMetric", { title: goal.title });
      for (const metric of goal.metrics) {
        const problem = metricProblem(metric);
        if (problem) return problem;
      }
    }
  }
  return null;
}

export function formatAmount(value: string, locale?: Locale): string {
  return formatNumber(Number(value || "0"), { maximumFractionDigits: 2 }, locale);
}
