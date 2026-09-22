import { createCrudRouter } from "platform-core";
import type { Goal } from "./api/goals";

/** One resource's worth of wiring (`List`/`Create`/`Edit`, `paths`) built once from `"/api/v1/goals"` - see `createCrudRouter`'s own docstring (platform-core). `GoalsScreen`/`GoalsCreateScreen`/`GoalsEditScreen` are thin wrappers around `.List`/`.Create`/`.Edit`; `goalsPaths.ts`'s `GOALS_PATHS` is this same router's `.paths`. */
export const GoalsRouter = createCrudRouter<Goal>("/api/v1/goals");
