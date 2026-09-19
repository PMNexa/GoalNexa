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
// shares the same promise instead.
let refreshPromise: Promise<LoginResponseLike> | null = null;

export function requestRefresh(): Promise<LoginResponseLike> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = apiFetch<LoginResponseLike>("/auth/refresh", {
    method: "POST",
    skipAuthRetry: true,
  })
    .then((response) => {
      setAccessToken(response.access_token);
      return response;
    })
    .catch((error) => {
      clearAccessToken();
      // Full page reload (not a router navigation) - deliberate, ensures all
      // in-memory state is wiped.
      window.location.assign("/login");
      throw error;
    })
    .finally(() => {
      refreshPromise = null;
    });

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
    await requestRefresh();
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
