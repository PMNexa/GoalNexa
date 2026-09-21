import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { OrgsScreen } from "platform-org-frontend";
import { getSession, isSessionInitialized, subscribeSession } from "../lib/session";
import type { Route } from "./+types/orgs";

export function meta({}: Route.MetaArgs) {
  return [{ title: "Organizations" }];
}

export default function Orgs() {
  const navigate = useNavigate();
  const [accessToken, setAccessToken] = useState<string | null>(() => getSession()?.accessToken ?? null);
  // Distinguishes "haven't checked yet" from "checked, no session" -
  // root.tsx's boot-time refreshSession() call hasn't necessarily
  // resolved yet on a fresh page load. Redirecting on accessToken===null
  // alone would fire before that check even had a chance to restore a
  // real session from the refresh cookie.
  const [initialized, setInitialized] = useState(isSessionInitialized());

  useEffect(() => {
    return subscribeSession(() => {
      setAccessToken(getSession()?.accessToken ?? null);
      setInitialized(isSessionInitialized());
    });
  }, []);

  useEffect(() => {
    if (initialized && accessToken === null) navigate("/auth/login", { replace: true });
  }, [initialized, accessToken, navigate]);

  if (!initialized) return null;
  if (accessToken === null) return null;
  return <OrgsScreen accessToken={accessToken} />;
}
