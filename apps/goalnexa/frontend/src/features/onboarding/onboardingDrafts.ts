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
  /** Its frequency (`snap_to`: "" any time, day ... year) and moment (`snap_weekday`, `snap_time`, ...); its metrics inherit it. */
  snapTo: string;
  moment: Record<string, unknown>;
  metrics: MetricDraft[];
}

/** Who the website path sets up for: personal goals ("me") or an organization ("team"). */
export type Audience = "me" | "team";

export type WebStep = "audience" | "organization" | "goals" | "metrics" | "review";

/**
 * The website path's steps (after "Get started", the choice between website
 * and agent): who it's for, the org's name (a team only), goals, metrics,
 * review. Adding goals to an org that exists starts at the goals.
 */
export function webSteps(existingOrg: boolean, audience: Audience | null): WebStep[] {
  if (existingOrg) return ["goals", "metrics", "review"];
  return ["audience", ...(audience === "me" ? [] : (["organization"] as const)), "goals", "metrics", "review"];
}
/** The AI-agent path's steps: connect it, give it the skills, first prompts. */
export const AGENT_STEPS = ["connect", "skills", "try"] as const;

export type Mode = "web" | "agent";

let nextKey = 1;
export const newMetric = (): MetricDraft => ({ key: nextKey++, name: "", description: "", unit: "", base: "0", target: "" });
/** A new goal checks in weekly, Monday 09:00 - a schedule, so reminders have something to remind of. */
export const newGoal = (): GoalDraft => ({
  key: nextKey++,
  title: "",
  description: "",
  targetDate: "",
  snapTo: "week",
  moment: { snap_weekday: "1", snap_time: "09:00" },
  metrics: [newMetric()],
});

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

export function stepProblem(step: WebStep, orgName: string, goals: GoalDraft[], audience: Audience | null): string | null {
  if (step === "audience") return audience ? null : translate(messages, "pickAudience");
  if (step === "organization") return orgName.trim() ? null : translate(messages, "orgNoName");
  if (step === "goals") {
    if (goals.length === 0) return translate(messages, "noGoals");
    return goals.every((goal) => goal.title.trim()) ? null : translate(messages, "goalNoTitle");
  }
  if (step === "metrics") {
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
