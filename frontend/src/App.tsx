import { Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { entityCrudRoutes } from "./container/entity-crud/entityCrudRoutes";

import { Login } from "./pages/workflows/Login/Login";
import { Signup } from "./pages/workflows/Signup/Signup";
import { AcceptInvite } from "./pages/workflows/AcceptInvite/AcceptInvite";
import { Dashboard } from "./pages/workflows/Dashboard/Dashboard";
import { OrgHome } from "./pages/workflows/OrgHome/OrgHome";
import { OrgMembers } from "./pages/workflows/OrgMembers/OrgMembers";
import { RootRedirect } from "./pages/workflows/RootRedirect/RootRedirect";

export default function App() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/invites/:token/accept" element={<AcceptInvite />} />
      <Route path="/" element={<RootRedirect />} />

      {/* Authenticated routes - each individually wrapped in ProtectedRoute,
          which is also the single place AppShell gets mounted. */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:orgId"
        element={
          <ProtectedRoute>
            <OrgHome />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orgs/:orgId/members"
        element={
          <ProtectedRoute>
            <OrgMembers />
          </ProtectedRoute>
        }
      />

      {entityCrudRoutes("/orgs/:orgId/admin")}
    </Routes>
  );
}
