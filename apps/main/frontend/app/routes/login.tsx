import { useNavigate } from "react-router";
import { RemoteLogin } from "platform-auth-frontend";
import type { Route } from "./+types/login";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Log in" }];
}

export default function Login() {
  const navigate = useNavigate();
  return <RemoteLogin onSuccess={() => navigate("/", { replace: true })} />;
}
