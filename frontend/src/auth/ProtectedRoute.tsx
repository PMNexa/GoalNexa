import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext";
import { Spinner } from "../components/atoms/spinner";
import { AppShell } from "../components/templates/app-shell";

/**
 * The single place that both gates auth and mounts app chrome. Don't wrap
 * children in <AppShell> anywhere else.
 */
export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { accessToken, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner />
      </div>
    );
  }

  if (!accessToken) {
    return <Navigate to="/login" replace />;
  }

  return <AppShell>{children}</AppShell>;
}
