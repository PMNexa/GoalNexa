import { apiRequest } from "./client";
import type { CheckIn } from "./checkIns";
import type { Goal } from "./goals";
import type { Metric } from "./metrics";

/**
 * The dashboard's reads - plain HTTP against this module's own resources
 * plus platform-org's `/api/v1/orgs` (HTTP contract only, no import of
 * `platform-org-frontend` - modules share nothing but their APIs).
 */

/** Just what the org picker needs - see platform-org's own `Organization` for the full shape. */
export interface OrgOption {
  id: string;
  name: string;
  /** The caller's role in it (platform-org's `my_role`). */
  my_role?: "owner" | "admin" | "member" | null;
}

interface Page<T> {
  items: T[];
  total: number;
}

// The backend caps page_size at 100 (core_api's pagination) - walk pages
// until `total` is reached rather than silently truncating.
const PAGE_SIZE = 100;

export async function fetchAll<T>(path: string, accessToken: string): Promise<T[]> {
  const joiner = path.includes("?") ? "&" : "?";
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiRequest<Page<T>>(`${path}${joiner}page=${page}&page_size=${PAGE_SIZE}`, accessToken);
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return items;
  }
}

/** A team of an org (platform-org's `/api/v1/teams`, HTTP only) - for the team filter. */
export interface TeamOption {
  id: string;
  name: string;
  parent: string | null;
}

export function fetchTeams(accessToken: string, orgId: string): Promise<TeamOption[]> {
  return fetchAll<TeamOption>(`/api/v1/teams?filter{org}=${encodeURIComponent(orgId)}&sort=name`, accessToken).catch(
    () => [], // a host without teams
  );
}

/** `teamId` and every team under it. */
export function teamSubtree(teams: TeamOption[], teamId: string): Set<string> {
  const found = new Set<string>([teamId]);
  let grew = true;
  while (grew) {
    grew = false;
    for (const team of teams) {
      if (team.parent && found.has(team.parent) && !found.has(team.id)) {
        found.add(team.id);
        grew = true;
      }
    }
  }
  return found;
}

export function fetchOrgs(accessToken: string): Promise<OrgOption[]> {
  return fetchAll<OrgOption>("/api/v1/orgs?sort=name", accessToken);
}

/** `orgId === null` = personal goals (no org). */
export function fetchGoals(accessToken: string, orgId: string | null): Promise<Goal[]> {
  const filter = orgId === null ? "filter{org_id.isnull}=true" : `filter{org_id}=${encodeURIComponent(orgId)}`;
  return fetchAll<Goal>(`/api/v1/goals?${filter}&sort=position,title`, accessToken);
}

/** One goal the caller can see, or `null` (gone, or not theirs). */
export function fetchGoal(accessToken: string, goalId: string): Promise<Goal | null> {
  return apiRequest<Goal>(`/api/v1/goals/${encodeURIComponent(goalId)}`, accessToken).catch(() => null);
}

export function fetchMetrics(accessToken: string, goalIds: string[]): Promise<Metric[]> {
  return fetchAll<Metric>(`/api/v1/metrics?filter{goal.in}=${goalIds.join(",")}&sort=position,name`, accessToken);
}

export function fetchCheckIns(accessToken: string, goalIds: string[]): Promise<CheckIn[]> {
  return fetchAll<CheckIn>(`/api/v1/check-ins?filter{metric.goal.in}=${goalIds.join(",")}`, accessToken);
}
