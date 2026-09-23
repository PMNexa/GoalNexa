import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getSession, isSessionInitialized, subscribeSession } from "platform-auth-frontend";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "GoalNexa" }];
}

export default function Home() {
  const [session, setSessionState] = useState(() => getSession());
  // Avoids a flash of "log in / sign up" before root.tsx's boot-time
  // initSession() has had a chance to restore an existing session on
  // a fresh page load - see platform-auth-frontend's session.ts.
  const [initialized, setInitialized] = useState(isSessionInitialized());

  useEffect(() => {
    return subscribeSession(() => {
      setSessionState(getSession());
      setInitialized(isSessionInitialized());
    });
  }, []);

  return (
    <div className="container py-4">
      <h1 className="h2 mb-4">GoalNexa</h1>
      {!initialized ? null : session ? (
        <>
          <p>
            Signed in as {session.user.name} ({session.user.email}).
          </p>
          <Link to="/platform-org/orgs" className="btn btn-primary">
            Organizations
          </Link>
        </>
      ) : (
        <div className="d-flex gap-2">
          <Link to="/auth/login?next=/platform-org/orgs" className="btn btn-primary">
            Log in
          </Link>
          <Link to="/auth/signup" className="btn btn-outline-primary">
            Sign up
          </Link>
        </div>
      )}
    </div>
  );
}
