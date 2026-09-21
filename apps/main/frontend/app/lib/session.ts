import type { Session } from "platform-auth-frontend";

/**
 * main's own record of the current session, captured from whatever
 * screen actually handled login/signup (platform-auth-frontend's
 * LoginScreen/SignupScreen `onSuccess` callback returns a `Session`) -
 * main passes the token down to any OTHER screen that needs to make its
 * own authenticated calls (e.g. platform-org-frontend's OrgsScreen).
 *
 * Plain module-level singleton, not React state - it resets on every
 * full page load/reload, same as platform-auth-frontend's own
 * tokenStore. `root.tsx`'s boot effect calls `refreshSession()` (the
 * httpOnly refresh cookie DOES survive a reload) to repopulate this on
 * every fresh page load, which is what makes "stay logged in" actually
 * work. Client-only; always null/uninitialized during SSR.
 */
let session: Session | null = null;
// False until the boot-time refresh attempt (root.tsx) has resolved,
// success or failure. A protected route (orgs.tsx) MUST wait for this
// before deciding "no session -> redirect to login" - checking
// `session === null` alone would redirect every fresh page load before
// the boot refresh even had a chance to run.
let initialized = false;
const subscribers = new Set<() => void>();

function notify(): void {
  for (const callback of subscribers) callback();
}

export function getSession(): Session | null {
  return session;
}

export function isSessionInitialized(): boolean {
  return initialized;
}

export function setSession(next: Session): void {
  session = next;
  // A fresh login/signup is definitive - no need to wait for the
  // separate boot-time refresh check (root.tsx) to also resolve, which
  // may not have finished yet if the user reached a login form directly.
  initialized = true;
  notify();
}

export function clearSession(): void {
  session = null;
  notify();
}

export function markSessionInitialized(): void {
  initialized = true;
  notify();
}

export function subscribeSession(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}
