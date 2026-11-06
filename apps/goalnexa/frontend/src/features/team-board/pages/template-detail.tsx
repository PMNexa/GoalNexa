import { CrudDetailScreen, localeFromMatches, translator, useResourcePath, useT, type LinkComponentProps } from "platform-core";
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import { useRoutePath } from "../../../lib/routePath";
import { TEAM_BOARD_ROUTE_ID } from "../routes";
import messages from "../messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(messages, localeFromMatches(matches))("templatePageTitle") }];
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
  const t = useT(messages);
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
          <span>{t("templateDetailInfo")}</span>
          <RouterLink className="btn btn-sm btn-primary ms-auto" to={`/${board}?template=${id}`}>
            {t("openBoard")}
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
