import type { Session } from "platform-auth-frontend";

/**
 * main's own record of the current session, captured from whatever
 * screen actually handled login/signup (platform-auth-frontend's
 * LoginScreen/SignupScreen `onSuccess` callback returns a `Session`) -
 * main passes the token down to any OTHER screen that needs to make its
 * own authenticated calls (e.g. platform-org-frontend's OrgsScreen).
 *
 * Plain module-level singleton, not React state or persisted storage -
 * same "lost on reload" tradeoff platform-auth-frontend's own tokenStore
 * accepts (no refresh endpoint exists yet to restore it silently on
 * boot). Client-only; always null during SSR.
 */
let session: Session | null = null;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const callback of subscribers) callback();
}

export function getSession(): Session | null {
  return session;
}

export function setSession(next: Session): void {
  session = next;
  notify();
}

export function clearSession(): void {
  session = null;
  notify();
}

export function subscribeSession(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
