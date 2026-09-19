import { Route } from "react-router-dom";
import { ProtectedRoute } from "../../auth/ProtectedRoute";
import { EntityListPage } from "./EntityListPage/EntityListPage";
import { EntityFormPage } from "./EntityFormPage/EntityFormPage";
import { EntityDetailPage } from "./EntityDetailPage/EntityDetailPage";

/**
 * `basePath` is the route pattern up to (but not including) the `:entity`
 * segment, e.g. "/orgs/:orgId/admin". Each page component reads `entityKey`
 * (and `orgId`/`id`) from route params via useParams itself. These are
 * authenticated routes, so each is individually wrapped in ProtectedRoute,
 * same as every other authenticated route in App.tsx.
 */
export function entityCrudRoutes(basePath: string) {
  return (
    <>
      <Route
        path={`${basePath}/:entity`}
        element={
          <ProtectedRoute>
            <EntityListPage basePath={basePath} />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${basePath}/:entity/:id/edit`}
        element={
          <ProtectedRoute>
            <EntityFormPage basePath={basePath} />
          </ProtectedRoute>
        }
      />
      <Route
        path={`${basePath}/:entity/:id`}
        element={
          <ProtectedRoute>
            <EntityDetailPage basePath={basePath} />
          </ProtectedRoute>
        }
      />
    </>
  );
}
