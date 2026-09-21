import { useEffect, useState } from "react";
import { Link } from "react-router";
import { getSession, subscribeSession } from "../lib/session";
import type { Route } from "./+types/home";

export function meta({}: Route.MetaArgs) {
  return [{ title: "GoalNexa" }];
}

export default function Home() {
  const [session, setSessionState] = useState(() => getSession());

  useEffect(() => subscribeSession(() => setSessionState(getSession())), []);

  return (
    <div className="container py-4">
      <h1 className="h2 mb-4">GoalNexa</h1>
      {session ? (
        <>
          <p>
            Signed in as {session.user.name} ({session.user.email}).
          </p>
          <Link to="/orgs" className="btn btn-primary">
            Organizations
          </Link>
        </>
      ) : (
        <div className="d-flex gap-2">
          <Link to="/auth/login" className="btn btn-primary">
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
