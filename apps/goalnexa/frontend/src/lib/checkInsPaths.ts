import { createCrudPaths } from "platform-core";

/** Same "one computation, shared by index.ts and routes/*.tsx" rule as `goalsPaths.ts`/`metricsPaths.ts`. */
export const CHECK_INS_PATHS = createCrudPaths("check-ins");
