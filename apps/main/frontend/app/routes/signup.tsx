import { useNavigate } from "react-router";
import { SignupScreen } from "platform-auth-frontend";
import type { Route } from "./+types/signup";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign up" }];
}

export default function Signup() {
  const navigate = useNavigate();
  return <SignupScreen onSuccess={() => navigate("/", { replace: true })} />;
}
