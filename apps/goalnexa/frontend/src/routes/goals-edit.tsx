import { useNavigate, useOutletContext } from "react-router";
import { GOALS_PATHS } from "../lib/goalsPaths";
import GoalsEditScreen from "../screens/GoalsEditScreen";

/** See `routes/goals.tsx`'s own docstring for why this file exists here rather than in `apps/main`. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Edit goal" }];
}

/**
 * `params` arrives as an ordinary prop regardless of where this file
 * lives - which route matched (and its `:id` segment) is decided by
 * `apps/main`'s `routes.ts`, not by this file's location, so react-router
 * still passes it through the normal way. Typed by hand (`{ id: string }`)
 * rather than via a generated `./+types/goals-edit` import - see
 * `routes/goals.tsx`'s docstring for why that generated module isn't
 * available here.
 */
export default function GoalsEditRoute({ params }: { params: { id: string } }) {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  const goToList = () => navigate(`/${GOALS_PATHS.listPath}`);

  return <GoalsEditScreen accessToken={accessToken} id={params.id} onUpdated={goToList} onDeleted={goToList} />;
}
