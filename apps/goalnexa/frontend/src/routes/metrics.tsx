import { Link as RouterLink, useOutletContext } from "react-router";
import type { LinkComponentProps } from "platform-core";
import MetricsScreen from "../screens/MetricsScreen";

/** See `routes/goals.tsx`'s own docstring for why this file exists here rather than in `apps/main`, and for the version-drift caveat that applies to every route module in this package. */
// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Metrics" }];
}

function MetricsLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

export default function MetricsRoute() {
  const accessToken = useOutletContext<string>();
  return <MetricsScreen accessToken={accessToken} linkComponent={MetricsLink} />;
}
