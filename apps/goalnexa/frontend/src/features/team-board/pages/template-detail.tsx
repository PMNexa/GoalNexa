import { CrudDetailScreen, useResourcePath, type LinkComponentProps } from "platform-core";
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import { useRoutePath } from "../../../lib/routePath";
import { TEAM_BOARD_ROUTE_ID } from "../routes";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Goal template" }];
}

function CrudLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/**
 * A goal template's page - registered by `createTemplatesRoutes()` as the
 * templates' `detailFile`: platform-core's generic detail screen (its goals
 * are a tab, each goal's metrics a tab on the goal's page), plus how to put
 * it to work - the team board, where it's added to teams.
 */
export default function TemplateDetailRoute() {
  const accessToken = useOutletContext<string>();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const resourcePath = useResourcePath();
  const board = useRoutePath(TEAM_BOARD_ROUTE_ID);
  const basePath = pathname.split("/").filter(Boolean).slice(0, -1).join("/");

  return (
    <div key={id}>
      {board && (
        <div className="alert alert-info d-flex flex-wrap align-items-center gap-2">
          <span>
            Every team using this template follows its goals and metrics - a change here reaches all of them. Each
            team sets its own targets.
          </span>
          <RouterLink className="btn btn-sm btn-primary ms-auto" to={`/${board}?template=${id}`}>
            Open the team board
          </RouterLink>
        </div>
      )}
      <CrudDetailScreen
        baseUrl="/api/v1/goal-templates"
        accessToken={accessToken}
        id={id}
        basePath={basePath}
        linkComponent={CrudLink}
        resourcePath={resourcePath}
        onDeleted={() => navigate(`/${basePath}`)}
      />
    </div>
  );
}
