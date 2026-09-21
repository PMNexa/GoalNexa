import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";
import { refreshSession } from "platform-auth-frontend";

import type { Route } from "./+types/root";
import "./app.css";
import { isSessionInitialized, markSessionInitialized, setSession } from "./lib/session";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
  // Tabler - screen packages (e.g. platform-auth-frontend's LoginScreen)
  // are built against its class names (card, form-control, btn, alert,
  // ...); a package's own index.html (which had its own Tabler <link>
  // for standalone dev) isn't used when imported as a package, so this
  // app - the one that actually owns the page shell - has to load it.
  {
    rel: "stylesheet",
    href: "https://cdn.jsdelivr.net/npm/@tabler/core@1.5.1/dist/css/tabler.min.css",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  // Runs once per real page load (never on client-side navigation
  // between routes, matching what it's actually restoring) - main's own
  // session store is a plain module singleton that resets on every fresh
  // load, but the httpOnly refresh cookie survives one, so this is what
  // makes "stay logged in across a reload" work. Idempotent no-op if
  // already initialized (e.g. React StrictMode's double-invoke in dev).
  useEffect(() => {
    if (isSessionInitialized()) return;
    let cancelled = false;
    refreshSession()
      .then((session) => {
        if (!cancelled) setSession(session);
      })
      .catch(() => {
        // No valid refresh cookie - just means "not logged in", not an error.
      })
      .finally(() => {
        if (!cancelled) markSessionInitialized();
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details =
      error.status === 404
        ? "The requested page could not be found."
        : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <main className="pt-16 p-4 container mx-auto">
      <h1>{message}</h1>
      <p>{details}</p>
      {stack && (
        <pre className="w-full p-4 overflow-x-auto">
          <code>{stack}</code>
        </pre>
      )}
    </main>
  );
}
