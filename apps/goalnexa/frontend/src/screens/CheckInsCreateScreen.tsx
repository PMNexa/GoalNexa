import { CheckInsRouter } from "../lib/checkInsRouter";
import type { CheckIn } from "../lib/api/checkIns";

export interface CheckInsCreateScreenProps {
  accessToken: string;
  onCreated?: (checkIn: CheckIn) => void;
}

/** The create screen - `CheckInsRouter.Create` (see `lib/checkInsRouter.ts`), schema-driven. */
function CheckInsCreateScreen(props: CheckInsCreateScreenProps) {
  return <CheckInsRouter.Create {...props} />;
}

export default CheckInsCreateScreen;
