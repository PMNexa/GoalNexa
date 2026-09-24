import { type RouteConfig, index, layout } from "@react-router/dev/routes";
import { createDashboardRoutes } from "goalnexa-frontend";
import { createAuthRoutes, createRbacRoutes } from "platform-auth-frontend";
import { createCrudRoutes } from "platform-core";
import { createMcpRoutes } from "platform-mcp-frontend";
import { createOrgsRoutes } from "platform-org-frontend";
import { createExtensionRoutes } from "./extensions";

export default [
  // `/` only redirects to /dashboard - there is no landing page.
  index("routes/index.tsx"),
  // platform-auth registered ONCE: this app picks the mount ("auth"),
  // platform-auth-frontend supplies every page under it (/auth/login,
  // /auth/signup) - storing the session and redirecting to `?next=`
  // (or /, i.e. the dashboard) on success are its own job, no route file here.
  ...createAuthRoutes("auth"),
  // AppShell (sidemenu + sticky header) wraps post-login screens only -
  // login/signup stay bare. See
  // routes/app-shell.tsx.
  //
  // Every generic CRUD resource's actual route leaf files live in
  // platform-core itself now (crud-list/crud-new/crud-detail/crud-edit,
  // shared by every resource - see their own docstrings and
  // createCrudRoutes's) - this app still owns every actual URL, it just
  // registers a whole resource with one call, giving only its own
  // backend base URL. The screens are fully generic (schema-driven),
  // including a record's relationships: the detail page (`/<resource>/:id`)
  // manages a goal's metrics / a metric's check-ins (1-n) and links
  // many-to-many rows, all from the schema.
  //
  // orgs is the one resource NOT registered with a bare `createCrudRoutes`
  // call here - `platform-org-frontend` provides `createOrgsRoutes`
  // (from its main entry) as a parameterized route builder, but
  // THIS app decides the mount prefix ("platform-org", passed in below),
  // same as it decides every other resource's URL - so its real URLs
  // are `platform-org/orgs`, `platform-org/orgs/new`,
  // `platform-org/orgs/:id/edit`. The sidebar nav link (app-shell.tsx)
  // hardcodes that same `"/platform-org/orgs"` string rather than
  // importing a computed path from platform-org-frontend - deliberately:
  // this is the ONE place that string is decided, so a plain literal at
  // its use site is no less "single source of truth" than a shared
  // constant would be, for a link that doesn't change.
  layout("routes/app-shell.tsx", [
    ...createDashboardRoutes("dashboard"),
    ...createOrgsRoutes("platform-org"),
    ...createCrudRoutes("/api/v1/goals"),
    ...createCrudRoutes("/api/v1/metrics"),
    ...createCrudRoutes("/api/v1/check-ins"),
    // Personal access tokens + how to connect an AI client to the MCP
    // server (platform-mcp) - one page, /mcp.
    ...createMcpRoutes("mcp"),
    // Role-based access control (platform-auth): users, roles, role
    // assignments, permissions under /platform-auth/.
    ...createRbacRoutes("platform-auth"),
    // A downstream build's own pages (e.g. hosted billing) - none in the
    // self-hosted build. See app/extensions/index.ts.
    ...createExtensionRoutes(),
  ]),
] satisfies RouteConfig;
