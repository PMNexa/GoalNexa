import { redirect } from "react-router";

/**
 * No landing page: `/` goes straight to the dashboard. The app-shell
 * layout gates it, so a visitor without a session lands on login with
 * `?next=/dashboard`; platform-auth's default post-login target (`/`)
 * ends up there too.
 */
export function loader() {
  return redirect("/dashboard");
}
