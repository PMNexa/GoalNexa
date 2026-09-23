import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { getSession, isSessionInitialized, subscribeSession } from "platform-auth-frontend";

/**
 * The session-gating boilerplate `orgs.tsx`/`orgs-new.tsx`/`orgs-edit.tsx`
 * all need, factored out once a third copy would've made it three - reads
 * the current access token, redirects to login once it's definitely
 * absent, and returns `null` while that's still being sorted out (so the
 * caller can `if (accessToken === null) return null;` and stop there).
 *
 * `initialized` distinguishes "haven't checked yet" from "checked, no
 * session" - root.tsx's boot-time `initSession()` call hasn't
 * necessarily resolved yet on a fresh page load. Redirecting on
 * `accessToken === null` alone would fire before that check even had a
 * chance to restore a real session from the refresh cookie.
 */
export function useRequireAccessToken(): string | null {
  const navigate = useNavigate();
  const location = useLocation();
  const [accessToken, setAccessToken] = useState<string | null>(() => getSession()?.accessToken ?? null);
  const [initialized, setInitialized] = useState(isSessionInitialized());

  useEffect(() => {
    return subscribeSession(() => {
      setAccessToken(getSession()?.accessToken ?? null);
      setInitialized(isSessionInitialized());
    });
  }, []);

  useEffect(() => {
    // `?next=` - platform-auth's login route sends the user back here
    // afterward.
    if (initialized && accessToken === null) {
      const next = encodeURIComponent(location.pathname + location.search);
      navigate(`/auth/login?next=${next}`, { replace: true });
    }
  }, [initialized, accessToken, navigate, location.pathname, location.search]);

  return initialized ? accessToken : null;
}
