import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { apiFetch, requestRefresh } from "../lib/api/client";
import { clearAccessToken, getAccessToken, setAccessToken, subscribe } from "../lib/auth/tokenStore";

export interface OrgSummary {
  id: string;
  name: string;
  slug: string;
}

export interface LoginResponse {
  access_token: string;
  orgs: OrgSummary[];
}

interface AuthContextValue {
  accessToken: string | null;
  orgs: OrgSummary[];
  isInitializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (
    email: string,
    password: string,
    name: string,
    orgName: string,
    orgSlug: string,
  ) => Promise<void>;
  acceptInvite: (token: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(getAccessToken());
  const [orgs, setOrgs] = useState<OrgSummary[]>([]);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    return subscribe((token) => setAccessTokenState(token));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await requestRefresh();
        if (!cancelled) setOrgs((response as LoginResponse).orgs ?? []);
      } catch {
        // Not logged in - that's fine, just means we start unauthenticated.
      } finally {
        if (!cancelled) setIsInitializing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    const response = await apiFetch<LoginResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(response.access_token);
    setOrgs(response.orgs ?? []);
  }

  async function signup(
    email: string,
    password: string,
    name: string,
    orgName: string,
    orgSlug: string,
  ) {
    const response = await apiFetch<LoginResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password, name, org_name: orgName, org_slug: orgSlug }),
    });
    setAccessToken(response.access_token);
    setOrgs(response.orgs ?? []);
  }

  async function acceptInvite(token: string, password: string) {
    const response = await apiFetch<LoginResponse>(`/invites/${token}/accept`, {
      method: "POST",
      body: JSON.stringify({ password }),
    });
    setAccessToken(response.access_token);
    setOrgs(response.orgs ?? []);
  }

  async function logout() {
    try {
      await apiFetch("/auth/logout", { method: "POST" });
    } finally {
      // Client-side logout must never depend on the network call succeeding.
      clearAccessToken();
      setOrgs([]);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, orgs, isInitializing, login, signup, acceptInvite, logout }),
    [accessToken, orgs, isInitializing],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
