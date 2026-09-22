import { useNavigate, useOutletContext } from "react-router";
import { CHECK_INS_PATHS } from "../lib/checkInsPaths";
import CheckInsEditScreen from "../screens/CheckInsEditScreen";

/** See `routes/goals.tsx`'s own docstring for why this file exists here rather than in `apps/main`. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Edit check-in" }];
}

/** `params` arrives as an ordinary prop regardless of where this file lives - see `routes/goals-edit.tsx`'s own docstring for why. */
export default function CheckInsEditRoute({ params }: { params: { id: string } }) {
  const accessToken = useOutletContext<string>();
  const navigate = useNavigate();
  const goToList = () => navigate(`/${CHECK_INS_PATHS.listPath}`);

  return <CheckInsEditScreen accessToken={accessToken} id={params.id} onUpdated={goToList} onDeleted={goToList} />;
}
