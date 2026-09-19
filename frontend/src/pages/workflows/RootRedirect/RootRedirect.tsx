import { Navigate } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { Spinner } from "../../../components/atoms/spinner";

export function RootRedirect() {
  const { accessToken, isInitializing } = useAuth();

  if (isInitializing) {
    return (
      <div className="d-flex justify-content-center align-items-center vh-100">
        <Spinner />
      </div>
    );
  }

  return <Navigate to={accessToken ? "/dashboard" : "/login"} replace />;
}
