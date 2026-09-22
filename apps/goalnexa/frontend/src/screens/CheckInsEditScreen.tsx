import { CheckInsRouter } from "../lib/checkInsRouter";
import type { CheckIn } from "../lib/api/checkIns";

export interface CheckInsEditScreenProps {
  accessToken: string;
  id: string;
  onUpdated?: (checkIn: CheckIn) => void;
  onDeleted?: () => void;
}

/** The edit screen - `CheckInsRouter.Edit` (see `lib/checkInsRouter.ts`), schema-driven; editing does NOT reassign `Metric.current_value` - see `CheckInViewSet.perform_update`'s own docstring. */
function CheckInsEditScreen(props: CheckInsEditScreenProps) {
  return <CheckInsRouter.Edit {...props} />;
}

export default CheckInsEditScreen;
