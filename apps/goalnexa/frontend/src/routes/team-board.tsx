import { useResourcePath, type LinkComponentProps } from "platform-core";
import { Link as RouterLink, useOutletContext, useSearchParams } from "react-router";
import TeamBoardScreen from "../screens/TeamBoardScreen";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Team board" }];
}

/** The edit drawer's links (related rows) are relative mount paths - same as platform-core's `crud-detail.tsx`. */
function BoardLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/**
 * Registered by `createTeamBoardRoutes()`; the token comes from the host's
 * app-shell layout. `?template=<id>` opens that template first (a
 * template's page links here).
 */
export default function TeamBoardRoute() {
  const accessToken = useOutletContext<string>();
  const [params] = useSearchParams();
  const resourcePath = useResourcePath();
  const templates = resourcePath("/api/v1/goal-templates");
  const goals = resourcePath("/api/v1/goals");
  return (
    <TeamBoardScreen
      accessToken={accessToken}
      initialTemplateId={params.get("template")}
      templateHref={templates ? (id) => `/${templates}/${id}` : undefined}
      goalHref={goals ? (id) => `/${goals}/${id}` : undefined}
      linkComponent={BoardLink}
      resourcePath={resourcePath}
    />
  );
}
