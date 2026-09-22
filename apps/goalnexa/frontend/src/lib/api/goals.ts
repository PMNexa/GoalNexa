export type GoalStatus = "not_started" | "in_progress" | "completed" | "archived";

export interface Goal {
  id: string;
  title: string;
  description: string;
  owner_id: string;
  org_id: string | null;
  status: GoalStatus;
  target_date: string | null;
  /** A sub-goal's parent - a bare id, `null` for a top-level goal. */
  parent: string | null;
}
