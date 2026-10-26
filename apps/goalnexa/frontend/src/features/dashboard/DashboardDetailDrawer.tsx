import { CrudDetailScreen, Drawer, type LinkComponent } from "platform-core";
import GoalActivityPanel from "../goals/GoalActivityPanel";
import GoalSharingPanel from "../goals/GoalSharingPanel";
import MetricIngestPanel from "../metrics/MetricIngestPanel";
import type { DetailTarget } from "./dashboardState";

export interface DashboardDetailDrawerProps {
  accessToken: string;
  /** The goal or metric shown, or `null` = closed. */
  detail: DetailTarget | null;
  /** Bumped when a panel changed the record - remounts the details (and the goal's feed) to reload them. */
  detailVersion: number;
  linkComponent?: LinkComponent;
  resourcePath?: (endpoint: string) => string | null;
  onClose: () => void;
  /** The record was deleted - or the user left the (private) goal. */
  onDeleted: () => void;
  /** The sharing or ingest panel changed the record. */
  onChanged: () => void;
}

/**
 * The dashboard's right-hand drawer: a goal's or metric's platform-core
 * `CrudDetailScreen`, then a goal's sharing panel and activity feed, or a
 * metric's automatic check-ins (`MetricIngestPanel`).
 */
function DashboardDetailDrawer({
  accessToken,
  detail,
  detailVersion,
  linkComponent,
  resourcePath,
  onClose,
  onDeleted,
  onChanged,
}: DashboardDetailDrawerProps) {
  return (
    <Drawer open={detail !== null} title={detail?.endpoint === "/api/v1/metrics" ? "Metric" : "Goal"} onClose={onClose}>
      {detail && (
        <CrudDetailScreen
          key={`${detail.endpoint}/${detail.id}/${detailVersion}`}
          baseUrl={detail.endpoint}
          accessToken={accessToken}
          id={detail.id}
          linkComponent={linkComponent}
          resourcePath={resourcePath}
          onDeleted={onDeleted}
        />
      )}
      {detail?.endpoint === "/api/v1/goals" && (
        <GoalSharingPanel
          key={detail.id}
          accessToken={accessToken}
          goalId={detail.id}
          onChanged={onChanged}
          onLeft={onDeleted}
        />
      )}
      {detail?.endpoint === "/api/v1/goals" && (
        <GoalActivityPanel key={`${detail.id}/${detailVersion}`} accessToken={accessToken} goalId={detail.id} />
      )}
      {detail?.endpoint === "/api/v1/metrics" && (
        <MetricIngestPanel
          key={detail.id}
          accessToken={accessToken}
          metricId={detail.id}
          onChanged={onChanged}
        />
      )}
    </Drawer>
  );
}

export default DashboardDetailDrawer;
