import { clearAccessToken, getAccessToken, setAccessToken } from "../auth/tokenStore";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export interface ApiErrorBody {
  code: string;
  message: string;
  field_errors: Record<string, string[]> | null;
}

export class ApiError extends Error {
  status: number;
  body: ApiErrorBody;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export interface ApiFetchOptions extends RequestInit {
  /**
   * Used by the refresh call itself to avoid infinite recursion: a 401 from
   * `/auth/refresh` must never trigger another refresh attempt.
   */
  skipAuthRetry?: boolean;
}

interface LoginResponseLike {
  access_token: string;
  orgs: unknown;
}

// Dedupe concurrent refresh attempts. Refresh tokens are single-use, so two
// concurrent refresh calls would break one of them - every caller in flight
// shares the same promise instead. This includes AuthContext's boot-time
// silent refresh (called directly, not just via apiFetch's 401 interceptor
// below) - see that call site for why a failure here must NOT clear the
// token store or redirect: on every anonymous page load (including /login
// itself) there is no session to restore, and that is not an error worth
// reacting to. Only the 401 interceptor's own catch does that, because only
// there does a failed refresh mean an actual session actually went stale.
let refreshPromise: Promise<LoginResponseLike> | null = null;

export function requestRefresh(): Promise<LoginResponseLike> {
  if (!refreshPromise) {
    refreshPromise = apiFetch<LoginResponseLike>("/auth/refresh", {
      method: "POST",
      skipAuthRetry: true,
    })
      .then((response) => {
        setAccessToken(response.access_token);
        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { skipAuthRetry, headers, ...rest } = options;

  const token = getAccessToken();
  const finalHeaders = new Headers(headers);
  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }
  const hasBody = rest.body !== undefined && rest.body !== null;
  if (hasBody && !finalHeaders.has("Content-Type")) {
    finalHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...rest,
    headers: finalHeaders,
    credentials: "include",
  });

  if (response.status === 401 && !skipAuthRetry) {
    try {
      await requestRefresh();
    } catch (error) {
      // The token store had a token that a real request just got rejected
      // with - that session is actually stale. Clear it and hard-redirect
      // (a full reload, not a router navigation, to guarantee all in-memory
      // state is wiped). Unlike requestRefresh() itself, this reaction is
      // scoped to here: only reachable when an authenticated call actually
      // failed, never for AuthContext's boot-time refresh on a page nobody
      // was ever logged into.
      clearAccessToken();
      window.location.assign("/login");
      throw error;
    }
    return apiFetch<T>(path, { ...options, skipAuthRetry: true });
  }

  if (response.status === 204) {
    return undefined as T;
  }

  if (!response.ok) {
    let body: ApiErrorBody;
    try {
      body = await response.json();
    } catch {
      body = { code: "unknown_error", message: response.statusText || "Request failed", field_errors: null };
    }
    throw new ApiError(response.status, body);
  }

  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}
