import axios from "axios";
import type { AxiosRequestConfig } from "axios";

/**
 * No token store of its own, deliberately - unlike platform-auth-frontend
 * (which owns the login flow, so it makes sense for it to hold the
 * token), this package is a pure consumer of a session someone else
 * created. The access token is passed in explicitly by the host on every
 * call (see screens/GoalsScreen.tsx's `accessToken` prop) rather than read
 * from some shared/global store this package would have to invent a way
 * to receive updates from.
 */
export const API_BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? "";

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(message: string, status: number, body?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

export async function apiRequest<T>(path: string, accessToken: string, config?: AxiosRequestConfig): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  try {
    const response = await axios.request<T>({
      url,
      ...config,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
        ...config?.headers,
      },
    });
    return (response.status === 204 ? undefined : response.data) as T;
  } catch (error) {
    if (!axios.isAxiosError(error)) throw error;
    if (!error.response) throw new ApiError(error.message || "Network request failed", 0);
    const { status, data: body } = error.response;
    const message =
      body !== null &&
      typeof body === "object" &&
      "message" in body &&
      typeof (body as { message?: unknown }).message === "string"
        ? (body as { message: string }).message
        : `Request to ${url} failed with status ${status}`;
    throw new ApiError(message, status, body);
  }
}
