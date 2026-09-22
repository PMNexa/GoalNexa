import { GoalsRouter } from "../lib/goalsRouter";
import type { Goal } from "../lib/api/goals";

export interface GoalsCreateScreenProps {
  accessToken: string;
  /** Fires after a successful create - typically the host navigates to `GOALS_PATH`. */
  onCreated?: (goal: Goal) => void;
}

/** The create screen - `GoalsRouter.Create` (see `lib/goalsRouter.ts`), schema-driven. */
function GoalsCreateScreen(props: GoalsCreateScreenProps) {
  return <GoalsRouter.Create {...props} />;
}

export default GoalsCreateScreen;
