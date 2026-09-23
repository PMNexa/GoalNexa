import { useNavigate, useOutletContext } from "react-router";
import { GOALS_PATHS } from "../lib/goalsPaths";
import GoalsEditScreen from "../screens/GoalsEditScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Edit goal" }];
}

/**
 * `platform-core`'s `createCrudRoutes("/api/v1/goals", { editFile: ... })`
 * points its edit route here instead of the generic `crud-edit.tsx` -
 * `GoalsEditScreen` renders `CrudEditScreen` plus this goal's own
 * `GoalMetricsSection`, which the generic file has no way to know about.
 * List/create for this resource stay on the generic files; only the
 * edit route needed this escape hatch. Same `params`-as-a-plain-prop,
 * `useOutletContext<string>()`-for-the-token shape `crud-edit.tsx`
 * itself uses (see its own docstring for why - this file lives outside
 * `apps/main`'s `app/` directory too, so no generated `./+types/...`
 * either).
 */
export default function GoalsEditRoute({ params }: { params: { id: string } }) {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  const goToList = () => navigate(`/${GOALS_PATHS.listPath}`);

  return <GoalsEditScreen accessToken={accessToken} id={params.id} onUpdated={goToList} onDeleted={goToList} />;
}
