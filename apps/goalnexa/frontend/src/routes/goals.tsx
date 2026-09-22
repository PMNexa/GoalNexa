import { Link as RouterLink, useOutletContext } from "react-router";
import type { LinkComponentProps } from "platform-core";
import GoalsScreen from "../screens/GoalsScreen";

/**
 * A real react-router route module, living in this package rather than
 * in `apps/main` - repeats platform-org-frontend's `routes/orgs.tsx`
 * pattern (see its own docstring for the full rationale and the
 * version-drift risk this carries - root AGENTS.md calls it "the one
 * deliberate exception" made at the host's explicit request; worth
 * confirming the host wants it repeated here before wiring this package
 * into apps/main, rather than assuming it by default).
 *
 * `useOutletContext<string>()` reads the access token `apps/main`'s
 * `app-shell.tsx` layout route already gated on and passed down via
 * `<Outlet context={accessToken} />` - this package still has no token
 * store or session-reading logic of its own, it just reads whatever the
 * host's layout already decided.
 */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Goals" }];
}

function GoalsLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

export default function GoalsRoute() {
  const accessToken = useOutletContext<string>();
  return <GoalsScreen accessToken={accessToken} linkComponent={GoalsLink} />;
}
