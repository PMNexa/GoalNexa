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
}

interface Page<T> {
  items: T[];
  total: number;
}

// The backend caps page_size at 100 (core_api's pagination) - walk pages
// until `total` is reached rather than silently truncating.
const PAGE_SIZE = 100;

async function fetchAll<T>(path: string, accessToken: string): Promise<T[]> {
  const joiner = path.includes("?") ? "&" : "?";
  const items: T[] = [];
  for (let page = 1; ; page += 1) {
    const result = await apiRequest<Page<T>>(`${path}${joiner}page=${page}&page_size=${PAGE_SIZE}`, accessToken);
    items.push(...result.items);
    if (result.items.length === 0 || items.length >= result.total) return items;
  }
}

export function fetchOrgs(accessToken: string): Promise<OrgOption[]> {
  return fetchAll<OrgOption>("/api/v1/orgs?sort=name", accessToken);
}

/** `orgId === null` = personal goals (no org). */
export function fetchGoals(accessToken: string, orgId: string | null): Promise<Goal[]> {
  const filter = orgId === null ? "filter{org_id.isnull}=true" : `filter{org_id}=${encodeURIComponent(orgId)}`;
  return fetchAll<Goal>(`/api/v1/goals?${filter}&sort=title`, accessToken);
}

export function fetchMetrics(accessToken: string, goalIds: string[]): Promise<Metric[]> {
  return fetchAll<Metric>(`/api/v1/metrics?filter{goal.in}=${goalIds.join(",")}`, accessToken);
}

export function fetchCheckIns(accessToken: string, goalIds: string[]): Promise<CheckIn[]> {
  return fetchAll<CheckIn>(`/api/v1/check-ins?filter{metric.goal.in}=${goalIds.join(",")}`, accessToken);
}
