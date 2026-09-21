import { useNavigate } from "react-router";
import { SignupScreen } from "platform-auth-frontend";
import { setSession } from "../lib/session";
import type { Route } from "./+types/signup";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Sign up" }];
}

export default function Signup() {
  const navigate = useNavigate();
  return (
    <SignupScreen
      onSuccess={(session) => {
        setSession(session);
        navigate("/", { replace: true });
      }}
    />
  );
}
