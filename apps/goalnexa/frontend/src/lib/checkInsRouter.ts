import { createCrudRouter } from "platform-core";
import type { CheckIn } from "./api/checkIns";

/** Same idea as `goalsRouter.ts` - `"/api/v1/check-ins"`. */
export const CheckInsRouter = createCrudRouter<CheckIn>("/api/v1/check-ins");
