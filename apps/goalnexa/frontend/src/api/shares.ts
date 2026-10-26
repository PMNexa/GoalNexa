import axios from "axios";
import { API_BASE_URL, apiRequest } from "./client";
import type { CheckIn } from "./checkIns";
import type { Goal } from "./goals";
import type { Metric } from "./metrics";

/** A public, read-only link to a set of goals on the dashboard - see the backend's `views/shares.py`. */
export interface DashboardShare {
  id: string;
  /** The secret part of the link - anyone holding it sees the goals. */
  token: string;
  title: string;
  goals: string[];
  hidden_metrics: string[];
  created_at: string;
}

export interface NewDashboardShare {
  title: string;
  goals: string[];
  hidden_metrics: string[];
}

/** What a link shows: only what the charts need, so these are trimmed `Goal`/`Metric`/`CheckIn`s. */
export interface SharedDashboard {
  title: string;
  goals: Pick<Goal, "id" | "title" | "status" | "target_date" | "parent" | "position" | "progress" | "projected_progress" | "health">[];
  metrics: Pick<Metric, "id" | "goal" | "name" | "unit" | "base_value" | "target_value" | "current_value" | "parent" | "position" | "aggregation">[];
  check_ins: Pick<CheckIn, "id" | "metric" | "value" | "checked_in_at" | "source">[];
  hidden_metrics: string[];
}

export function fetchShares(accessToken: string): Promise<DashboardShare[]> {
  return apiRequest<{ items: DashboardShare[] }>("/api/v1/dashboard-shares", accessToken).then((page) => page.items);
}

export function createShare(accessToken: string, share: NewDashboardShare): Promise<DashboardShare> {
  return apiRequest<DashboardShare>("/api/v1/dashboard-shares", accessToken, { method: "POST", data: share });
}

export function deleteShare(accessToken: string, id: string): Promise<void> {
  return apiRequest<void>(`/api/v1/dashboard-shares/${encodeURIComponent(id)}`, accessToken, { method: "DELETE" });
}

/** No login: the token in the link is the only credential. `null` = revoked or never existed. */
export async function fetchSharedDashboard(token: string): Promise<SharedDashboard | null> {
  try {
    const response = await axios.get<SharedDashboard>(
      `${API_BASE_URL}/api/v1/shared-dashboards/${encodeURIComponent(token)}`,
    );
    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) return null;
    throw error;
  }
}
