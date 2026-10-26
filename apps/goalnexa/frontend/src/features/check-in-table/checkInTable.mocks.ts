/** Sample data for the check-in table's stories, built from the shared fixtures. */
import { checkIns, goals, metrics, orgs } from "../../storybook/fixtures";
import { buildTable, type TableData } from "./buildTable";
import type { Snap } from "./tableColumns";

export const ORG_ID = orgs[0].id;

/** The fixtures as the screen loads them for Acme (no teams). */
export const tableData: TableData = {
  org: ORG_ID,
  goals,
  metrics,
  checkIns,
  teamNames: new Map(),
};

/** The fixtures' table, with `snap`-sized columns (weeks start on Monday). */
export function sampleTable(snap: Snap = "week") {
  return buildTable(tableData, new Set(), snap, 1);
}

/** The localStorage keys the screen remembers its state in. */
export const STORAGE_KEYS = [
  "goalnexa:table-view",
  "goalnexa:table-goals",
  "goalnexa:table-collapsed",
  "goalnexa:dashboard-org",
];

/** Starts a story from a clean browser: none of the screen's remembered state. */
export function clearStored() {
  for (const key of STORAGE_KEYS) window.localStorage.removeItem(key);
}

/** Remembers `value` under `key` for one story (cleared again afterwards). */
export function stored(key: string, value: unknown) {
  return () => {
    window.localStorage.setItem(key, JSON.stringify(value));
    return clearStored;
  };
}
