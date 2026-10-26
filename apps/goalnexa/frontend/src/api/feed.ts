import { apiRequest } from "./client";
import { fetchAll } from "./dashboard";

/**
 * A goal's activity feed (`/api/v1/activities`, read-only) and its
 * comments (`/api/v1/goal-comments`) - the backend's `views/feed.py`.
 */
export type ActivityVerb =
  | "goal_created"
  | "goal_changed"
  | "metric_added"
  | "metric_changed"
  | "metric_removed"
  | "checked_in"
  | "check_in_changed"
  | "check_in_removed"
  | "health_changed"
  | "commented"
  | "scored";

export interface Activity {
  id: string;
  goal: string;
  /** Null: the system (a health change) or an ingest-token check-in. */
  actor_id: string | null;
  verb: ActivityVerb;
  data: Record<string, unknown>;
  created_at: string;
}

export interface GoalComment {
  id: string;
  goal: string;
  author_id: string;
  body: string;
  check_in: string | null;
  created_at: string;
}

/** The newest 50 entries. */
export async function fetchActivities(accessToken: string, goalId: string): Promise<Activity[]> {
  const page = await apiRequest<{ items: Activity[] }>(`/api/v1/activities?filter{goal}=${goalId}&page_size=50`, accessToken);
  return page.items;
}

export function fetchComments(accessToken: string, goalId: string): Promise<GoalComment[]> {
  return fetchAll<GoalComment>(`/api/v1/goal-comments?filter{goal}=${goalId}`, accessToken);
}

export function addComment(accessToken: string, goalId: string, body: string): Promise<GoalComment> {
  return apiRequest<GoalComment>("/api/v1/goal-comments", accessToken, { method: "POST", data: { goal: goalId, body } });
}

export function deleteComment(accessToken: string, commentId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/goal-comments/${commentId}`, accessToken, { method: "DELETE" });
}
