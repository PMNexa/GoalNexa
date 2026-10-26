import { apiRequest } from "./client";
import { fetchAll } from "./dashboard";
import type { Goal, GoalHealth } from "./goals";

/**
 * Cycles (`/api/v1/cycles`) - the periods goals are set for - and how
 * each goal scored when its cycle closed (`/api/v1/goal-scores`). Closing
 * is `POST cycles/<id>/close` (the backend's `goalnexa/cycles.py`).
 */
export type CycleStatus = "planning" | "active" | "closed";

export interface Cycle {
  id: string;
  name: string;
  owner_id: string;
  org_id: string | null;
  starts_on: string;
  ends_on: string;
  status: CycleStatus;
  closed_at: string | null;
  retro: string;
}

export type GoalOutcome = "achieved" | "partial" | "missed" | "dropped";

export interface GoalScore {
  id: string;
  goal: string;
  cycle: string;
  /** 0.00-1.00, a decimal string. */
  score: string;
  outcome: GoalOutcome;
  final_progress: string | null;
  final_health: GoalHealth;
  reflection: string;
  rolled_to: string | null;
  created_at: string;
}

export type CloseAction = "done" | "rollover" | "drop";

export interface CloseDecision {
  goal: string;
  action: CloseAction;
  score: number;
  reflection: string;
}

export function fetchCycle(accessToken: string, id: string): Promise<Cycle> {
  return apiRequest<Cycle>(`/api/v1/cycles/${id}`, accessToken);
}

/** An org's cycles, or the personal ones (`orgId === null`), newest first. */
export function fetchCycles(accessToken: string, orgId: string | null): Promise<Cycle[]> {
  const filter = orgId === null ? "filter{org_id.isnull}=true" : `filter{org_id}=${encodeURIComponent(orgId)}`;
  return fetchAll<Cycle>(`/api/v1/cycles?${filter}&sort=-starts_on`, accessToken);
}

export function fetchCycleGoals(accessToken: string, cycleId: string): Promise<Goal[]> {
  return fetchAll<Goal>(`/api/v1/goals?filter{cycle}=${cycleId}&sort=title`, accessToken);
}

export function fetchCycleScores(accessToken: string, cycleId: string): Promise<GoalScore[]> {
  return fetchAll<GoalScore>(`/api/v1/goal-scores?filter{cycle}=${cycleId}`, accessToken);
}

export function createCycle(
  accessToken: string,
  data: { name: string; org_id: string | null; starts_on: string; ends_on: string; status: CycleStatus },
): Promise<Cycle> {
  return apiRequest<Cycle>("/api/v1/cycles", accessToken, { method: "POST", data });
}

export function closeCycle(
  accessToken: string,
  cycleId: string,
  data: { decisions: CloseDecision[]; next_cycle: string | null; retro: string },
): Promise<{ cycle: Cycle; scores: GoalScore[] }> {
  return apiRequest(`/api/v1/cycles/${cycleId}/close`, accessToken, { method: "POST", data });
}

/** Goals titled by id - e.g. a closed cycle's goals, now completed or archived. */
export function fetchGoalsById(accessToken: string, ids: string[]): Promise<Goal[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return fetchAll<Goal>(`/api/v1/goals?filter{id.in}=${ids.join(",")}`, accessToken);
}
