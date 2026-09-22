import { CrudListScreen } from "platform-core";
import type { LinkComponent } from "platform-core";
import { createGoalsCrudConfig } from "../lib/goalsCrudConfig";
import { useGoalOptions } from "../lib/useGoalOptions";
import type { Goal } from "../lib/api/goals";

export interface GoalsScreenProps {
  /**
   * No token store of its own (see lib/api/client.ts's own docstring) -
   * the host passes in whatever access token it already has (e.g. from
   * platform-auth-frontend's LoginScreen/SignupScreen `onSuccess`
   * callback), scoped to however long the host's own session lasts.
   */
  accessToken: string;
  /** Wraps the "New"/per-row "Edit" links - defaults to a plain `<a>` (`CrudListScreen`'s own default) when the host doesn't pass its own router's `Link`. See `GOALS_NEW_PATH`/`goalsEditPath` for the paths these should point at. */
  linkComponent?: LinkComponent;
  onDeleted?: (goal: Goal) => void;
}

/** The list screen - `platform-core`'s `CrudListScreen` preconfigured for `Goal`. See `goalsCrudConfig.ts` for the actual API wiring. Renders straight away, same non-blocking `useGoalOptions` use as `MetricsScreen` - see its own docstring. */
function GoalsScreen({ accessToken, linkComponent, onDeleted }: GoalsScreenProps) {
  const { goalOptions } = useGoalOptions(accessToken);
  return <CrudListScreen config={createGoalsCrudConfig(accessToken, goalOptions ?? [], linkComponent)} onDeleted={onDeleted} />;
}

export default GoalsScreen;
