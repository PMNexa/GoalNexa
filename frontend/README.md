# GoalNexa Frontend

Auth, the design-system components, the generic entity-CRUD engine, and the app shell all come from the [`platform-core`](https://github.com/EugeneNguyen/platform-core) git submodule (`../platform-core/frontend`), consumed **in place** — `src/main.tsx` imports `App` and `registerOrgScopedEntity` directly from `../platform-core/frontend/src/...`, not a copy of that code. This directory's own source is deliberately tiny: `main.tsx` (registers the `Goal` entity, sets up the design system, mounts `App`) plus test files that exercise the "consume in place" wiring itself.

See the root `README.md`'s "Consuming platform-core in place" section for the full picture.

## Stack

React 18, Vite 5, TypeScript 5, React Router v6, TanStack Query v5, React Hook Form + Zod — all platform-core's own choices, since its source is what actually renders. This project's own `package.json` declares the exact same runtime dependency versions platform-core's does, for a reason that matters more than usual here: see "Why the symlink" below.

**Design system**: Tabler (`@tabler/core`), installed as an npm package here rather than loaded from platform-core's own CDN `<link>` (see `../platform-core/frontend/index.html`) — GoalNexa is self-hosted, and its core UI shouldn't depend on jsdelivr being reachable at runtime. Font Awesome for icons. Both imported once in `main.tsx`; platform-core's own source files carry no CSS imports of their own, so this is enough for every component rendered through `App`.

## Getting started

```bash
npm install
npm run dev
```

`npm install`'s `postinstall` runs `scripts/link-platform-core-node-modules.mjs` automatically — see "Why the symlink" below before assuming you can skip it.

The dev server runs on `http://localhost:30566` and proxies `/api/*` to `http://localhost:8000` (see `vite.config.ts`) — platform-core's own backend mounts everything under `/api/v1/...` except `/health`, so this must pass the path through unchanged rather than stripping `/api`, with one explicit exception for `/api/health`. Under `docker compose up`, nginx does the same routing on the same port (see `../nginx/default.conf`) — either way the app calls relative `/api/...` paths by default, so it works unmodified in both setups.

### Environment variables

Copy `.env.example` to `.env` only if you want to point the frontend at a backend that isn't reachable via the dev proxy / nginx (e.g. a remote or staging API):

```
VITE_API_BASE_URL=http://localhost:8000
```

## Why the symlink

Node/Vite resolves a bare import (`react`, `react-router-dom`, ...) by walking **up the directory tree from the importing file's own location** looking for a `node_modules` folder. A file under `../platform-core/frontend/src/...` walking up from there would find `platform-core/frontend/node_modules` (if it existed) or `platform-core/node_modules` — neither of which is an ancestor of this project's own `frontend/node_modules`, since `frontend/` and `platform-core/` are siblings under the repo root.

Left alone, that means npm-installing `platform-core/frontend` separately would give the page **two independent copies of React** — components under `platform-core/frontend/src` (i.e. almost the whole app) would use one, this project's own two files would use the other. React's hooks require every component in a tree to share exactly one React module instance; two copies throws the classic "Invalid hook call" error the moment anything tries to render.

`scripts/link-platform-core-node-modules.mjs` (this project's own `postinstall`) fixes this by symlinking `platform-core/frontend/node_modules` to this project's own — so the directory walk described above finds this project's copy instead of a second one. It's a **relative** symlink (`../../frontend/node_modules`), not absolute — an absolute one bit a real bug during development: the same script also runs inside the docker-compose frontend container's own `npm install`, and an absolute container-internal path written into the bind-mounted host checkout dangled the moment anything ran against it outside Docker (see the script's own comments for the full story, including a second real bug it hit: `fs.rmSync` on a symlink-to-a-directory throws "Path is a directory" unless given `recursive: true`, which a naive `catch {}` silently swallowed).

`vite.config.ts`'s `resolve.dedupe` is a second, independent layer of defense against the same failure mode.

`src/App.smoke.test.tsx` is the regression test for all of this: it renders platform-core's actual `App` from inside this project and asserts it doesn't throw. A passing `npm run build` alone would **not** catch a broken symlink — bundlers happily bundle two copies of a package without erroring; only a real render exercises React's hook-dispatcher singleton check.

## Scripts

- `npm run dev` - start the Vite dev server
- `npm run typecheck` - `tsc --noEmit`
- `npm run build` - typecheck, then produce a production build in `dist/`
- `npm run preview` - preview the production build locally
- `npm run test` - run the Vitest suite once
- `npm run test:watch` - run Vitest in watch mode

## Adding a new entity

One line in `main.tsx`: `registerOrgScopedEntity({key: "<resource>s", label: "<Label>"})`, called before `ReactDOM.createRoot(...).render(...)`. `registerOrgScopedEntity` (from `platform-core/frontend/src/pages/admin/registry.ts`) is an extension point added to platform-core specifically for a git-submodule consumer — it mutates the registry's existing arrays/maps in place rather than requiring an edit to that file, so `AppSidebar`/`AppBreadcrumb`/`useEntitySchema` all pick it up with no platform-core changes. The matching backend half is `backend/goalnexa_ext/routes/<entity>.py`'s `register_entity_config()` call — see `../backend/README.md`. Once both are registered, the list/form/detail admin pages are fully generic; no new frontend page code is needed.

## Testing

- `src/App.smoke.test.tsx` - renders platform-core's `App` from inside this project; the regression test for the "consume in place" symlink setup (see above).
- `src/goalRegistration.test.ts` - confirms `registerOrgScopedEntity` actually lands in platform-core's registry (and is a no-op on a duplicate key).

Platform-core's own frontend test suite (component-level, ~600 tests as of this writing) covers everything it renders — `AppShell`, `AppHeader`, `Login`, the generic `EntityTable`/`EntityForm`, etc. — from inside its own repo; this project doesn't re-test that.
