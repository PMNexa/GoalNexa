import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { OrgsScreen } from "platform-org-frontend";
import { getSession, subscribeSession } from "../lib/session";
import type { Route } from "./+types/orgs";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Organizations" }];
}

export default function Orgs() {
  const navigate = useNavigate();
  // Client-only, populated after hydration - the session store is a
  // plain module singleton with no SSR-visible state (see lib/session.ts's
  // own docstring), so this always starts null on the server render and
  // only resolves once the browser's own session (if any) is checked.
  const [accessToken, setAccessToken] = useState<string | null>(() => getSession()?.accessToken ?? null);

  useEffect(() => {
    return subscribeSession(() => setAccessToken(getSession()?.accessToken ?? null));
  }, []);

  useEffect(() => {
    if (accessToken === null) navigate("/auth/login", { replace: true });
  }, [accessToken, navigate]);

  if (accessToken === null) return null;
  return <OrgsScreen accessToken={accessToken} />;
}
