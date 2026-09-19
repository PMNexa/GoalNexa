# GoalNexa Frontend

A self-hosted goal/habit/OKR tracker (personal + team use). This is the React
frontend, built with a small, config-driven "entity CRUD" engine so new
tracked entity types (habits, OKRs, ...) can be added later by writing a
declarative `EntityConfig`, not new pages.

## Stack

- React 18 + Vite 5 + TypeScript 5
- React Router v6 (flat routes, no layout routes)
- TanStack Query v5 for server state
- React Hook Form + Zod for forms/validation (uncontrolled inputs via
  `register()` only - this codebase never uses RHF's `Controller`)
- Tabler (`@tabler/core`, built on Bootstrap 5) for styling — installed as
  an npm package rather than loaded from a CDN, since this is a self-hosted
  app (raw utility/component classes in JSX, no CSS-in-JS, no component
  library; Tabler's own JS bundle is not loaded — all interactive state,
  e.g. the org-switcher dropdown, is plain React state)
- Font Awesome Free for icons
- Vitest + Testing Library for tests

## Getting started

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:30566` and proxies any request to
`/api/*` to `http://localhost:8000` (see `vite.config.ts`), where the
GoalNexa backend is expected to be running. Under `docker compose up`
instead, nginx is the single entrypoint on the same port and does this same
`/api/*` routing (see `../nginx/default.conf`) — either way the app calls
relative `/api/...` paths by default, so it works unmodified in both setups.

### Environment variables

Copy `.env.example` to `.env` only if you want to point the frontend at a
backend that isn't reachable via the dev proxy / nginx (e.g. a remote or
staging API):

```
VITE_API_BASE_URL=http://localhost:8000
```

## Scripts

- `npm run dev` - start the Vite dev server
- `npm run typecheck` - `tsc --noEmit`
- `npm run build` - typecheck, then produce a production build in `dist/`
- `npm run preview` - preview the production build locally
- `npm run test` - run the Vitest suite once
- `npm run test:watch` - run Vitest in watch mode

## Architecture notes

- **Auth** (`src/lib/auth/tokenStore.ts`, `src/lib/api/client.ts`,
  `src/auth/AuthContext.tsx`): the access token lives in an in-memory module
  singleton, never localStorage - deliberate, since `apiFetch` needs a
  synchronous read outside of React and an in-memory token backed by an
  httpOnly refresh cookie is less exposed to XSS than a token sitting in
  localStorage. `apiFetch` retries once on a 401 via a deduped
  `requestRefresh()` (refresh tokens are single-use, so concurrent callers
  share one in-flight refresh); a failed refresh clears the token and does a
  full `window.location.assign("/login")` reload to guarantee all in-memory
  state is wiped.
- **RBAC**: there is no role/admin boolean in the client. Every write
  affordance is gated by `usePermissions(orgId).has("<resource>.<action>")`,
  which fails closed (returns `false` while loading or on error) and hides
  the element entirely rather than disabling it. The server remains the real
  enforcement point; these checks are UX-only. Sidebar nav links are
  deliberately *not* permission-gated - navigating to something you can't
  use just surfaces the API's 403.
- **Entity CRUD engine** (`src/entityConfigs/`, `src/lib/api/entityCrud.ts`,
  `src/components/organisms/entity-form`, `entity-table`,
  `src/container/entity-crud/`): list/detail/form pages, the table, and the
  form (including its Zod schema) are all generated from a static
  `EntityConfig` object (see `src/entityConfigs/goal.ts` for the one entity
  currently wired up, Goal). Adding a new tracked entity is meant to mostly
  be "write a new `EntityConfig` + register it in
  `entityConfigByKey`", not new page components.

## Testing

A handful of smoke tests exercise the load-bearing pieces:

- `src/auth/ProtectedRoute.test.tsx` - unauthenticated visitors get redirected
  to `/login`.
- `src/components/organisms/entity-form/entity-form.test.tsx` - the
  config-driven form surfaces Zod validation errors for required fields.
- `src/components/atoms/button/button.test.tsx` - trivial render check
  confirming the test runner itself works.

This is not full coverage - see TODOs below.

## Known TODOs / deviations for a human to revisit

- Test coverage is intentionally minimal (a handful of smoke tests, not a
  full suite) per the scaffold's scope.
- `EntityTable` sorting toggles asc -> desc -> unsorted client-side state;
  it assumes the backend understands a `sort` query param of `field` /
  `-field`, matching the API contract's `GET /goals?...&sort=` param but not
  yet verified against a live backend.
- The org switcher and `OrgMembers` invite/suspend flows are wired against
  the documented API contract but have not been exercised against a running
  backend (per the task, the backend is being built in parallel).
- No dark/light theme toggle, no responsive collapse for the sidebar on
  mobile - the shell is intentionally minimal.
