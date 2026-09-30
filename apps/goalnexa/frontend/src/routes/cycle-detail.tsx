import { useState } from "react";
import { CrudDetailScreen, useResourcePath, type LinkComponentProps } from "platform-core";
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import CyclePanel from "../screens/CyclePanel";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Cycle" }];
}

function CrudLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/**
 * A cycle's page - registered by `createCyclesRoutes()` as the cycles'
 * `detailFile`: platform-core's generic detail screen (its goals are a
 * tab), then closing it or, once closed, its scores (`CyclePanel`).
 */
export default function CycleDetailRoute() {
  const accessToken = useOutletContext<string>();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const resourcePath = useResourcePath();
  const basePath = pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  // Bumped when the panel closes the cycle, so the details show it.
  const [version, setVersion] = useState(0);

  return (
    <div key={id}>
      <CrudDetailScreen
        key={version}
        baseUrl="/api/v1/cycles"
        accessToken={accessToken}
        id={id}
        basePath={basePath}
        linkComponent={CrudLink}
        resourcePath={resourcePath}
        onDeleted={() => navigate(`/${basePath}`)}
      />
      <CyclePanel accessToken={accessToken} cycleId={id} onClosed={() => setVersion((v) => v + 1)} />
    </div>
  );
}
