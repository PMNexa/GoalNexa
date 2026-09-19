/**
 * In-memory access-token store.
 *
 * Deliberately NOT localStorage/sessionStorage:
 * - `apiFetch` is a plain function with no React/hook access and needs a
 *   synchronous read of the current token on every request.
 * - A bare JWT sitting in localStorage is more exposed to XSS token-theft
 *   than a short-lived in-memory value backed by an httpOnly refresh cookie.
 *
 * This is a module-level singleton (not a class/hook) so `client.ts` can read
 * it outside of React, while `AuthContext` subscribes to mirror it into state
 * for components that need to re-render on change.
 */
let accessToken: string | null = null;

type Listener = (token: string | null) => void;
const listeners: Listener[] = [];

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) listener(accessToken);
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

export function subscribe(callback: Listener): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}
