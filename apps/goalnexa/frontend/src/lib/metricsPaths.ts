import { createCrudPaths } from "platform-core";

/** Same "one computation, shared by index.ts and routes/*.tsx" rule as `goalsPaths.ts`. */
export const METRICS_PATHS = createCrudPaths("metrics");
