import { Link as RouterLink } from "react-router";
import type { LinkComponentProps } from "platform-core";

/** AppShell's `linkComponent` - react-router's Link (platform-core has no router of its own). */
export function ShellLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={to} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}
