import { useState } from "react";
import { CrudDetailScreen, useResourcePath, type LinkComponentProps } from "platform-core";
import { Link as RouterLink, useLocation, useNavigate, useOutletContext, useParams } from "react-router";
import MetricIngestPanel from "../screens/MetricIngestPanel";

// oxlint-disable-next-line react/only-export-components
export function meta() {
  return [{ title: "Metric" }];
}

function CrudLink({ to, className, children, ...rest }: LinkComponentProps) {
  return (
    <RouterLink to={`/${to}`} className={className} {...rest}>
      {children}
    </RouterLink>
  );
}

/**
 * A metric's page - registered by `createMetricsRoutes()` as the metrics'
 * `detailFile`: platform-core's generic detail screen, then its automatic
 * check-ins (ingest token). Same shape as `goal-detail.tsx`.
 */
export default function MetricDetailRoute() {
  const accessToken = useOutletContext<string>();
  const { id = "" } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const resourcePath = useResourcePath();
  const basePath = pathname.split("/").filter(Boolean).slice(0, -1).join("/");
  // Bumped when the panel changes the token, so the details show its hint.
  const [version, setVersion] = useState(0);

  return (
    <div key={id}>
      <CrudDetailScreen
        key={version}
        baseUrl="/api/v1/metrics"
        accessToken={accessToken}
        id={id}
        basePath={basePath}
        linkComponent={CrudLink}
        resourcePath={resourcePath}
        onDeleted={() => navigate(`/${basePath}`)}
      />
      <MetricIngestPanel accessToken={accessToken} metricId={id} onChanged={() => setVersion((v) => v + 1)} />
    </div>
  );
}
