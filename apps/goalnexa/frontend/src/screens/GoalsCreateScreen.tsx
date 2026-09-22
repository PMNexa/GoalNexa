import { CrudCreateScreen } from "platform-core";
import { createGoalsCrudConfig } from "../lib/goalsCrudConfig";
import { useGoalOptions } from "../lib/useGoalOptions";
import type { Goal } from "../lib/api/goals";

export interface GoalsCreateScreenProps {
  accessToken: string;
  /** Fires after a successful create - typically the host navigates to `GOALS_PATH`. */
  onCreated?: (goal: Goal) => void;
}

/**
 * The create screen - `platform-core`'s `CrudCreateScreen` preconfigured
 * for `Goal` (`title`/`description`/`parent` - see `goalsCrudConfig.ts`'s
 * own docstring on why `status`/`target_date` aren't form fields yet).
 * Not gated on `useGoalOptions` like `MetricsCreateScreen` is on its own
 * (required) `goal` field - `parent` is optional, so rendering with
 * whatever's loaded so far (possibly `[]`, briefly) is fine.
 */
function GoalsCreateScreen({ accessToken, onCreated }: GoalsCreateScreenProps) {
  const { goalOptions } = useGoalOptions(accessToken);
  return <CrudCreateScreen config={createGoalsCrudConfig(accessToken, goalOptions ?? [])} onCreated={onCreated} />;
}

export default GoalsCreateScreen;
