import { useState } from "react";
import { CrudDetailScreen, localeFromMatches, translator, type LinkComponentProps, useResourcePath } from "platform-core";
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import GoalActivityPanel from "../GoalActivityPanel";
import GoalSharingPanel from "../GoalSharingPanel";
import messages from "./messages";

// oxlint-disable-next-line react/only-export-components
export function meta({ matches }: { matches?: readonly unknown[] }) {
  return [{ title: translator(messages, localeFromMatches(matches))("pageTitle") }];
}

function CrudLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/**
 * A goal's page - registered by `createGoalsRoutes()` as the goals'
 * `detailFile`: platform-core's generic detail screen (same props its own
 * `crud-detail.tsx` passes), then who the goal is shared with.
 */
export default function GoalDetailRoute() {
  const accessToken = useOutletContext<string>();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const resourcePath = useResourcePath();
  // Every segment but the id - where the goals list is mounted.
  const basePath = pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  // Bumped when the panel changes the goal, so the details show it.
  const [version, setVersion] = useState(0);

  return (
    <div key={id}>
      <CrudDetailScreen
        key={version}
        baseUrl="/api/v1/goals"
        accessToken={accessToken}
        id={id}
        basePath={basePath}
        linkComponent={CrudLink}
        resourcePath={resourcePath}
        onDeleted={() => navigate(`/${basePath}`)}
      />
      <GoalSharingPanel
        accessToken={accessToken}
        goalId={id}
        onChanged={() => setVersion((v) => v + 1)}
        onLeft={() => navigate(`/${basePath}`)}
      />
      <GoalActivityPanel key={version} accessToken={accessToken} goalId={id} />
    </div>
  );
}
