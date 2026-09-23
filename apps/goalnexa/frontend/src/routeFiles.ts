import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Absolute paths to this package's own custom edit-route files, for
 * `apps/main`'s `routes.ts` to pass as `createCrudRoutes`'s `editFile`
 * option (see `platform-core`'s own `lib/routes.ts` docstring on that
 * option, and why an absolute path built from THIS file's own
 * `import.meta.url` is required, not a relative string). Its own
 * `package.json` `exports` subpath (`"goalnexa-frontend/routeFiles"`),
 * not part of the main `"."` entry - this imports `node:path`/`node:url`
 * and is meant for `apps/main`'s Node-only `routes.ts`, never the
 * client bundle.
 */
const routesDir = join(dirname(fileURLToPath(import.meta.url)), "routes");

export const GOALS_EDIT_ROUTE_FILE = join(routesDir, "goals-edit.tsx");
export const METRICS_EDIT_ROUTE_FILE = join(routesDir, "metrics-edit.tsx");
