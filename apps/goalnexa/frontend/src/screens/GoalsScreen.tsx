import type { LinkComponent } from "platform-core";
import { GoalsRouter } from "../lib/goalsRouter";
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

/**
 * The list screen - `GoalsRouter.List` (see `lib/goalsRouter.ts`),
 * schema-driven (see `platform-core`'s `CrudListScreen` docstring). A
 * real, known regression versus the old hand-written column: `parent`
 * renders as a bare id, not a looked-up goal title - `createSchemaColumns`
 * (platform-core) has no way to know that lookup itself yet.
 */
function GoalsScreen(props: GoalsScreenProps) {
  return <GoalsRouter.List {...props} />;
}

export default GoalsScreen;
