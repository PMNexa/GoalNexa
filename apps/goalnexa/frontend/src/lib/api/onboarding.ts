import { apiRequest } from "./client";
import type { Goal } from "./goals";
import type { Metric } from "./metrics";

/**
 * The onboarding wizard's writes - plain HTTP against platform-org's
 * `/api/v1/orgs` (creating an org makes the caller its first member) and
 * this module's own goals/metrics. Same "APIs only, no imports" rule as
 * `dashboard.ts`.
 */

export function createOrg(accessToken: string, name: string): Promise<{ id: string; name: string }> {
  return apiRequest("/api/v1/orgs", accessToken, { method: "POST", data: { name } });
}

export function createGoal(
  accessToken: string,
  data: { title: string; description: string; org_id: string | null; target_date: string | null },
): Promise<Goal> {
  return apiRequest<Goal>("/api/v1/goals", accessToken, { method: "POST", data });
}

export function createMetric(
  accessToken: string,
  data: { goal: string; name: string; description: string; unit: string; base_value: number; target_value: number },
): Promise<Metric> {
  return apiRequest<Metric>("/api/v1/metrics", accessToken, { method: "POST", data });
}

/** How the user said they'll use GoalNexa (the wizard's first step) - for the admin's activation funnel. Only the first answer is kept. */
export function saveOnboardingChoice(accessToken: string, choice: "web" | "agent"): Promise<{ choice: string }> {
  return apiRequest("/api/v1/onboarding-choice", accessToken, { method: "POST", data: { choice } });
}
