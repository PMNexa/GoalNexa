export type GoalStatus = "not_started" | "in_progress" | "completed" | "archived";

/** Public: the whole org sees an org goal. Private: its owner and members only. */
export type GoalVisibility = "public" | "private";

/** Server-computed, from the projection to the target date - see the backend's `goalnexa.progress`. */
export type GoalHealth = "unknown" | "on_track" | "at_risk" | "off_track" | "achieved";

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
  /** Server-computed over ALL its root metrics (the dashboard recomputes its own, with hidden metrics left out). Decimal strings, in %. */
  progress: string | null;
  projected_progress: string | null;
  health: GoalHealth;
}
