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
  snap_to: TargetPer;
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
  /** With "Show by": this cell's numbers in that period - see `ShownNumbers`. */
  shown?: ShownNumbers | null;
  /** With `periods`: its numbers in each of those periods, oldest first ("Over time"). */
  history?: (ShownNumbers | null)[];
}

/**
 * One cell in a shown period (the board's "Show by"): `value` = the amount
 * done in it, or the last reading by its end (null: none yet); `quota` =
 * its target when the metric's target is per that same period. A total's
 * comes from its teams' by the metric's rule (null: not totalled).
 */
export interface ShownNumbers {
  /** The period's first and last day, "YYYY-MM-DD". */
  start: string;
  last: string;
  value: number | null;
  quota: number | null;
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
  /** Template goal id -> its latest check-in on the board's day (`on_day`, null: none that day) and ever (`last`). */
  last_update?: Record<string, { on_day: string | null; last: string | null }>;
}

export interface BoardTotal {
  goals: Record<string, string>;
  metrics: Record<string, CellNumbers>;
  can_plan: boolean;
  /** Template goal id -> how many of the total's teams have a copy, and how many were updated on the board's day. */
  updated?: Record<string, { teams: number; updated: number }>;
}

export interface Board {
  template: { id: string; title: string; org_id: string };
  cycle: string | null;
  /** The "Show by" period the cells' `shown` numbers are for, or "". */
  show?: string;
  can_manage: boolean;
  goals: BoardGoal[];
  metrics: BoardMetric[];
  teams: BoardTeam[];
  /** Team id -> its instance. */
  instances: Record<string, BoardInstance>;
  /** Team id, or "org" for the whole organization -> its total. */
  totals: Record<string, BoardTotal>;
  /** Which totals are calculated (ticked): "org" and/or team ids. */
  total_for: string[];
}

export function fetchTemplates(accessToken: string, orgId: string): Promise<GoalTemplate[]> {
  return fetchAll<GoalTemplate>(`/api/v1/goal-templates?filter{org_id}=${encodeURIComponent(orgId)}&sort=title`, accessToken);
}

/**
 * `show` + `at` (ISO): also each cell's numbers in the period around `at`
 * (the board's "Show by"); + `periods`: in that many periods up to it ("Over time").
 */
export function fetchBoard(
  accessToken: string,
  templateId: string,
  cycleId: string | null,
  shownPeriod?: { show: string; at: string; periods?: number },
): Promise<Board> {
  return apiRequest<Board>(`/api/v1/goal-templates/${templateId}/board`, accessToken, {
    params: { cycle: cycleId ?? "none", ...(shownPeriod ?? {}) },
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

/** Take teams out (unticked): a copy with check-ins is kept as the team's own goals, an empty one deleted. */
export function leaveTemplate(
  accessToken: string,
  templateId: string,
  teams: string[],
  cycleId: string | null,
): Promise<{ deleted: string[]; detached: string[] }> {
  return apiRequest(`/api/v1/goal-templates/${templateId}/leave`, accessToken, {
    method: "POST",
    data: { teams, cycle: cycleId },
  });
}

/** Which totals are calculated: "org" and/or ids of teams with sub-teams. */
export function setTemplateTotals(accessToken: string, templateId: string, totalFor: string[]): Promise<{ total_for: string[] }> {
  return apiRequest(`/api/v1/goal-templates/${templateId}/totals`, accessToken, { method: "POST", data: { total_for: totalFor } });
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
    snap_to?: TargetPer;
  },
): Promise<{ id: string }> {
  return apiRequest<{ id: string }>("/api/v1/template-metrics", accessToken, { method: "POST", data });
}
