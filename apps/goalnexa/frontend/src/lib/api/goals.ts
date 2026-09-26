export type GoalStatus = "not_started" | "in_progress" | "completed" | "archived";

/** Public: the whole org sees an org goal. Private: its owner and members only. */
export type GoalVisibility = "public" | "private";

export interface Goal {
  id: string;
  title: string;
  description: string;
  owner_id: string;
  org_id: string | null;
  status: GoalStatus;
  target_date: string | null;
  visibility: GoalVisibility;
  /** A sub-goal's parent - a bare id, `null` for a top-level goal. */
  parent: string | null;
}
