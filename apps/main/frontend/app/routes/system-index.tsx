import { redirect } from "react-router";

/** `/system` itself has no page: open Status (the console's first page). */
export function loader() {
  return redirect("/system/status");
}
