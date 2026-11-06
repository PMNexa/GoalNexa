import { useEffect } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useMatches,
  useRouteLoaderData,
} from "react-router";
import { AuthScreenProvider, initSession } from "platform-auth-frontend";
import { defineMessages, LocaleProvider, localeFromRequest, registerFieldWidget, useT, type Locale } from "platform-core";
import { CheckInMomentField } from "goalnexa-frontend";
import { BrandHome } from "./lib/brand";

import type { Route } from "./+types/root";
// Tabler - screen packages (e.g. platform-auth-frontend's LoginScreen)
// are built against its class names (card, form-control, btn, alert,
// ...); a package's own index.html (which had its own Tabler <link>
// for standalone dev) isn't used when imported as a package, so this
// app - the one that actually owns the page shell - has to load it.
// Served from our own /assets (hashed, cached for a year) rather than a
// CDN: one origin less before the first paint, and no third party
// between a self-hosted instance and its users. A `links` entry, as when
// it came from the CDN, so it keeps its place after app.css in the head.
import tablerCss from "@tabler/core/dist/css/tabler.min.css?url";
import tablerJs from "@tabler/core/dist/js/tabler.min.js?url";
import "./app.css";

// Form widgets the modules provide, used by every generic form (`widget` in a form layout).
registerFieldWidget("check-in-moment", CheckInMomentField);

// The UI language for the server render: the `gn_lang` cookie, else the
// browser's Accept-Language, else English (platform-core's i18n). The
// client reads the same cookie, so hydration matches.
export function loader({ request }: Route.LoaderArgs) {
  return { locale: localeFromRequest(request) };
}

const messages = defineMessages({
  en: { oops: "Oops!", error: "Error", unexpected: "An unexpected error occurred.", notFound: "The requested page could not be found." },
  vi: { oops: "Rất tiếc!", error: "Lỗi", unexpected: "Đã xảy ra lỗi không mong muốn.", notFound: "Không tìm thấy trang bạn yêu cầu." },
});

export const links: Route.LinksFunction = () => [{ rel: "stylesheet", href: tablerCss }];

export function Layout({ children }: { children: React.ReactNode }) {
  // Search engines index only pages whose route opts in with
  // `handle = { indexable: true }` (a public page, e.g. a hosted edition's
  // landing page); the app itself, sign-in and shared links stay out.
  const locale: Locale = useRouteLoaderData<typeof loader>("root")?.locale ?? "en";
  const indexable = useMatches().some((match) => (match.handle as { indexable?: boolean } | undefined)?.indexable);
  return (
    <html lang={locale}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {!indexable && <meta name="robots" content="noindex" />}
        <Meta />
        <Links />
      </head>
      <body>
        <LocaleProvider locale={locale}>{children}</LocaleProvider>
        <ScrollRestoration />
        <Scripts />
        {/* Tabler's JS bundle (includes Bootstrap's) - platform-core's
            Sidebar organism uses data-bs-toggle="collapse" for its mobile
            navbar-toggler button, which is inert without it. Same "host
            loads the design system" convention as the Tabler CSS link
            above. */}
        <script src={tablerJs} defer />
      </body>
    </html>
  );
}

export default function App() {
  // Runs once per real page load - platform-auth's session store is a
  // plain module singleton that resets on every fresh load, but the
  // httpOnly refresh cookie survives one, so this is what makes "stay
  // logged in across a reload" work. Idempotent (see initSession's own
  // docstring), so React StrictMode's double-invoke is harmless.
  useEffect(() => {
    void initSession();
  }, []);

  // The login/signup pages are platform-auth's own route modules - this
  // is how they get this app's logo and name, linking home, as their heading.
  return (
    <AuthScreenProvider title={<BrandHome />}>
      <Outlet />
    </AuthScreenProvider>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  const t = useT(messages);
  let message = t("oops");
  let details = t("unexpected");
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : t("error");
    details = error.status === 404 ? t("notFound") : error.statusText || details;
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
