import { useNavigate, useOutletContext } from "react-router";
import { CHECK_INS_PATHS } from "../lib/checkInsPaths";
import CheckInsCreateScreen from "../screens/CheckInsCreateScreen";

/** See `routes/goals.tsx`'s own docstring for why this file exists here rather than in `apps/main`. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "New check-in" }];
}

export default function CheckInsNewRoute() {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  return <CheckInsCreateScreen accessToken={accessToken} onCreated={() => navigate(`/${CHECK_INS_PATHS.listPath}`)} />;
}
