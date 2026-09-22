import { CrudEditScreen } from "platform-core";
import { createGoalsCrudConfig } from "../lib/goalsCrudConfig";
import { useGoalOptions } from "../lib/useGoalOptions";
import type { Goal } from "../lib/api/goals";
import GoalMetricsSection from "./GoalMetricsSection";

export interface GoalsEditScreenProps {
  accessToken: string;
  /** The goal's id - a prop, not read from a router param (same rule `CrudEditScreen` itself follows for the same reason - see platform-core's AGENTS.md). The host reads its own `:id` param and passes it here. */
  id: string;
  onUpdated?: (goal: Goal) => void;
  onDeleted?: () => void;
}

/**
 * The edit screen - `platform-core`'s `CrudEditScreen` preconfigured for
 * `Goal`, plus this goal's own metrics (list + a lightweight add form -
 * see `GoalMetricsSection`'s own docstring for why it isn't a full CRUD
 * screen). `useGoalOptions(accessToken, id)` excludes this goal itself
 * from its own `parent` picker - see that hook's own docstring.
 */
function GoalsEditScreen({ accessToken, id, onUpdated, onDeleted }: GoalsEditScreenProps) {
  const { goalOptions } = useGoalOptions(accessToken, id);
  return (
    <>
      <CrudEditScreen config={createGoalsCrudConfig(accessToken, goalOptions ?? [])} id={id} onUpdated={onUpdated} onDeleted={onDeleted} />
      <GoalMetricsSection accessToken={accessToken} goalId={id} />
    </>
  );
}

export default GoalsEditScreen;
