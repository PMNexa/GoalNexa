import { createCrudPaths } from "platform-core";

/**
 * Shared by `index.ts` (public `GOALS_PATH`/`GOALS_NEW_PATH`/`goalsEditPath`
 * exports) and `routes/*.tsx` (internal post-action navigation) - one
 * computation, not two, so a route file and the paths a host wires it up
 * with can never drift apart.
 */
export const GOALS_PATHS = createCrudPaths("goals");
