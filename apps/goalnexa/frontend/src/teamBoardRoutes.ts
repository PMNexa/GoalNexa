import { createCrudRoutes, routeFilePath, type RouteEntry } from "platform-core";

/** The route id a template's page looks up to link to the board. */
export const TEAM_BOARD_ROUTE_ID = "goalnexa-team-board";

/**
 * The team board (one goal template, every team: check-ins, targets and
 * totals in one grid) at a HOST-chosen path, inside the host's app-shell
 * layout. Browser-safe, same as `createDashboardRoutes`.
 */
export function createTeamBoardRoutes(basePath: string): RouteEntry[] {
  return [
    {
      id: TEAM_BOARD_ROUTE_ID,
      path: basePath.replace(/^\/+|\/+$/g, ""),
      file: routeFilePath(import.meta.url, "routes/team-board.tsx"),
    },
  ];
}

/**
 * Goal templates' pages - platform-core's generic CRUD screens for the
 * template (`goal-templates`, whose page also links to the team board -
 * `routes/template-detail.tsx`), its goals (`template-goals`) and their
 * metrics (`template-metrics`), each with its children as tabs.
 */
export function createTemplatesRoutes(): RouteEntry[] {
  return [
    ...createCrudRoutes("/api/v1/goal-templates", {
      detailFile: routeFilePath(import.meta.url, "routes/template-detail.tsx"),
    }),
    ...createCrudRoutes("/api/v1/template-goals"),
    ...createCrudRoutes("/api/v1/template-metrics"),
  ];
}
