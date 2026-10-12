import { useContext } from "react";
import { UNSAFE_FrameworkContext } from "react-router";

interface ManifestRoute {
  parentId?: string;
  path?: string;
}

/**
 * The full path of a route the HOST mounted, from its id in the route
 * manifest (e.g. `"goalnexa-team-board"` -> `"board"`), so a link follows
 * wherever the host put it. `null` when the host didn't mount it. Only for
 * route files (it reads react-router's context) - screens get hrefs as props.
 */
export function useRoutePath(routeId: string): string | null {
  const routes = useContext(UNSAFE_FrameworkContext)?.manifest.routes as Record<string, ManifestRoute | undefined> | undefined;
  let route = routes?.[routeId];
  if (!route) return null;
  const segments: string[] = [];
  while (route) {
    if (route.path) segments.unshift(route.path.replace(/^\/+|\/+$/g, ""));
    route = route.parentId ? routes?.[route.parentId] : undefined;
  }
  return segments.join("/");
}
