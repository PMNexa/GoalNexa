import { ApiError, apiRequest } from "./client";
import { fetchAll } from "./dashboard";
import type { Goal, GoalVisibility } from "./goals";

/**
 * Who a goal is shared with (`/api/v1/goal-members`), plus the org's
 * members to pick from - platform-org's `/api/v1/org-members` (HTTP
 * contract only), which also gives their names and emails, since a goal
 * member row carries only a `user_id`.
 */

export interface GoalMember {
  id: string;
  goal: string;
  user_id: string;
  created_at: string;
}

/** Just what the sharing panel needs - see platform-org's own `Member` for the full shape. */
export interface OrgPerson {
  user_id: string;
  name: string | null;
  email: string | null;
  is_me: boolean;
}

export function fetchGoal(accessToken: string, goalId: string): Promise<Goal> {
  return apiRequest<Goal>(`/api/v1/goals/${goalId}`, accessToken);
}

export function fetchOrgName(accessToken: string, orgId: string): Promise<string> {
  return apiRequest<{ name: string }>(`/api/v1/orgs/${orgId}`, accessToken).then((org) => org.name);
}

export function setGoalVisibility(accessToken: string, goalId: string, visibility: GoalVisibility): Promise<Goal> {
  return apiRequest<Goal>(`/api/v1/goals/${goalId}`, accessToken, { method: "PATCH", data: { visibility } });
}

export function fetchGoalMembers(accessToken: string, goalId: string): Promise<GoalMember[]> {
  return fetchAll<GoalMember>(`/api/v1/goal-members?filter{goal}=${goalId}`, accessToken);
}

export function fetchOrgPeople(accessToken: string, orgId: string): Promise<OrgPerson[]> {
  return fetchAll<OrgPerson>(`/api/v1/org-members?filter{org}=${orgId}`, accessToken);
}

export function addGoalMember(accessToken: string, goalId: string, userId: string): Promise<GoalMember> {
  return apiRequest<GoalMember>("/api/v1/goal-members", accessToken, {
    method: "POST",
    data: { goal: goalId, user_id: userId },
  });
}

export function removeGoalMember(accessToken: string, memberId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/goal-members/${memberId}`, accessToken, { method: "DELETE" });
}

/** A validation error's field messages when there are any, else the error's own message. */
export function errorMessage(thrown: unknown): string {
  if (thrown instanceof ApiError) {
    const fieldErrors = (thrown.body as { field_errors?: Record<string, string[]> } | undefined)?.field_errors;
    if (fieldErrors) return Object.values(fieldErrors).flat().join(" ");
  }
  return thrown instanceof Error ? thrown.message : String(thrown);
}
