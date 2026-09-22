import { useNavigate, useOutletContext } from "react-router";
import { GOALS_PATHS } from "../lib/goalsPaths";
import GoalsCreateScreen from "../screens/GoalsCreateScreen";

/** See `routes/goals.tsx`'s own docstring for why this file exists here rather than in `apps/main`. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "New goal" }];
}

export default function GoalsNewRoute() {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  return <GoalsCreateScreen accessToken={accessToken} onCreated={() => navigate(`/${GOALS_PATHS.listPath}`)} />;
}
