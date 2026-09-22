import { GoalsRouter } from "./goalsRouter";

/**
 * Shared by `index.ts` (public `GOALS_PATH`/`GOALS_NEW_PATH`/`goalsEditPath`
 * exports) and `routes/*.tsx` (internal post-action navigation) - one
 * computation, not two, so a route file and the paths a host wires it up
 * with can never drift apart. Just `GoalsRouter.paths` (see
 * `goalsRouter.ts`).
 */
export const GOALS_PATHS = GoalsRouter.paths;
