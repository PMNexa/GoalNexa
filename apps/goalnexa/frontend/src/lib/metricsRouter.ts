import { createCrudRouter } from "platform-core";
import type { Metric } from "./api/metrics";

/** Same idea as `goalsRouter.ts` - `"/api/v1/metrics"`. */
export const MetricsRouter = createCrudRouter<Metric>("/api/v1/metrics");
