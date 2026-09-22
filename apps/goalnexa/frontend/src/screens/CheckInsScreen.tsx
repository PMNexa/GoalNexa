import type { LinkComponent } from "platform-core";
import { CheckInsRouter } from "../lib/checkInsRouter";
import type { CheckIn } from "../lib/api/checkIns";

export interface CheckInsScreenProps {
  accessToken: string;
  linkComponent?: LinkComponent;
  onDeleted?: (checkIn: CheckIn) => void;
}

/** The list screen - `CheckInsRouter.List` (see `lib/checkInsRouter.ts`), schema-driven (same known regression as `MetricsScreen`'s own note: `metric` shows its bare id). */
function CheckInsScreen(props: CheckInsScreenProps) {
  return <CheckInsRouter.List {...props} />;
}

export default CheckInsScreen;
