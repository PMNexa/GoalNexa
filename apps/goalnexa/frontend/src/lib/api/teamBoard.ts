import { apiRequest } from "./client";
import { fetchAll } from "./dashboard";
import type { Pace, TargetPer } from "./metrics";

/**
 * Goal templates and the team board (docs/team-templates.md) - the
 * backend's `views/templates.py`: `GET goal-templates/<id>/board` is one
 * call with everything the grid shows; saving is `POST check-ins/bulk`
 * (check-ins) or `POST goal-templates/<id>/targets` (targets, planned
 * targets), each all or nothing.
 */
export interface GoalTemplate {
  id: string;
  org_id: string;
  title: string;
  description: string;
  owner_id: string;
}

export type RollupRule = "sum" | "avg" | "min" | "none";

export interface BoardGoal {
  id: string;
  parent: string | null;
  title: string;
}

export interface BoardMetric {
  id: string;
  template_goal: string;
  parent: string | null;
  name: string;
  unit: string;
  aggregation: "latest" | "sum";
  rollup: RollupRule;
  default_target: number | null;
  target_per: TargetPer;
  count_days: "all" | "weekdays";
  progress_by: "total" | "hit_rate";
  one_per: TargetPer;
}

export interface BoardTeam {
  id: string;
  parent: string | null;
  name: string;
}

export interface CellNumbers {
  /** The instance's (or total's) own metric id. */
  id: string;
  base_value: number;
  target_value: number;
  current_value: number;
  progress: number | null;
  check_in_due_at: string | null;
  last_checked_in_at: string | null;
  /** Totals only. */
  planned_target?: number | null;
  /** Totals only: what the teams committed to, before any planned target. */
  teams_target?: number;
  target_per: TargetPer;
  period_value: number | null;
  cumulative_target: number | null;
  expected_value: number | null;
  hit_rate: number | null;
  streak: number | null;
  pace: Pace | null;
}

export interface BoardInstance {
  visible: boolean;
  goals: Record<string, string>;
  metrics: Record<string, CellNumbers>;
  root?: string;
  visibility?: string;
  status?: string;
  can_check_in?: boolean;
  can_set_targets?: boolean;
}

export interface BoardTotal {
  goals: Record<string, string>;
  metrics: Record<string, CellNumbers>;
  can_plan: boolean;
}

export interface Board {
  template: { id: string; title: string; org_id: string };
  cycle: string | null;
  can_manage: boolean;
  goals: BoardGoal[];
  metrics: BoardMetric[];
  teams: BoardTeam[];
  /** Team id -> its instance. */
  instances: Record<string, BoardInstance>;
  /** Team id, or "org" for the whole organization -> its total. */
  totals: Record<string, BoardTotal>;
}

export function fetchTemplates(accessToken: string, orgId: string): Promise<GoalTemplate[]> {
  return fetchAll<GoalTemplate>(`/api/v1/goal-templates?filter{org_id}=${encodeURIComponent(orgId)}&sort=title`, accessToken);
}

export function fetchBoard(accessToken: string, templateId: string, cycleId: string | null): Promise<Board> {
  return apiRequest<Board>(`/api/v1/goal-templates/${templateId}/board`, accessToken, {
    params: { cycle: cycleId ?? "none" },
  });
}

export interface BulkCheckIn {
  metric: string;
  value: string;
  note?: string;
  checked_in_at?: string;
}

export function saveCheckIns(accessToken: string, items: BulkCheckIn[]): Promise<unknown> {
  return apiRequest("/api/v1/check-ins/bulk", accessToken, { method: "POST", data: { items } });
}

export interface TargetChange {
  metric: string;
  base_value?: string;
  target_value?: string;
  planned_target?: string | null;
}

export function saveTargets(accessToken: string, templateId: string, items: TargetChange[]): Promise<void> {
  return apiRequest(`/api/v1/goal-templates/${templateId}/targets`, accessToken, { method: "POST", data: { items } });
}

export function applyTemplate(
  accessToken: string,
  templateId: string,
  teams: string[],
  cycleId: string | null,
): Promise<{ goals: string[] }> {
  return apiRequest(`/api/v1/goal-templates/${templateId}/apply`, accessToken, {
    method: "POST",
    data: { teams, cycle: cycleId },
  });
}

export function createTemplate(
  accessToken: string,
  data: { org_id: string; title: string; description: string },
): Promise<GoalTemplate> {
  return apiRequest<GoalTemplate>("/api/v1/goal-templates", accessToken, { method: "POST", data });
}

export function createTemplateGoal(
  accessToken: string,
  data: { template: string; title: string; parent?: string },
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/api/v1/template-goals", accessToken, { method: "POST", data });
}

export function createTemplateMetric(
  accessToken: string,
  data: {
    template_goal: string;
    name: string;
    unit: string;
    aggregation: "latest" | "sum";
    rollup: RollupRule;
    default_base: string;
    default_target?: string;
    target_per?: TargetPer;
    count_days?: "all" | "weekdays";
    progress_by?: "total" | "hit_rate";
    one_per?: TargetPer;
  },
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/api/v1/template-metrics", accessToken, { method: "POST", data });
}
