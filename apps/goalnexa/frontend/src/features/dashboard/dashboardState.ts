import type { Cycle } from "../../api/cycles";
import { readStored, writeStored } from "../../lib/storedState";
import { MAX_GOALS } from "./useDashboardCharts";

/**
 * The dashboard's constants and small helpers: the cycle filter's special
 * values, what it remembers in localStorage (and under which keys), the
 * `?goal=` link, and color-slot picking. No React - `DashboardScreen` uses them.
 */

/** What the details drawer shows: a goal or a metric, by its API base URL. */
export interface DetailTarget {
  endpoint: "/api/v1/goals" | "/api/v1/metrics";
  id: string;
}

/** The cycle filter: every goal, goals in no cycle, or one cycle's (its id). */
export const ALL_CYCLES = "all";
export const NO_CYCLE = "none";

/** The cycle running today, if any - what the dashboard opens on. */
export function currentCycle(cycles: Cycle[]): Cycle | undefined {
  const today = new Date().toISOString().slice(0, 10);
  return cycles.find((c) => c.status === "active" && c.starts_on <= today && today <= c.ends_on);
}

/** Set once a user without an org skips the onboarding wizard - not asked again in this browser. */
export const ONBOARDING_SKIPPED_KEY = "goalnexa:onboarding-skipped";

export function onboardingSkipped(): boolean {
  try {
    return window.localStorage.getItem(ONBOARDING_SKIPPED_KEY) !== null;
  } catch {
    return false;
  }
}

export function skipOnboarding() {
  try {
    window.localStorage.setItem(ONBOARDING_SKIPPED_KEY, "1");
  } catch {
    // Asked again next time - harmless.
  }
}

export function toError(thrown: unknown): Error {
  return thrown instanceof Error ? thrown : new Error(String(thrown));
}

/**
 * `?goal=<id>` - the link an AI agent's reply (or a reminder) ends with:
 * the dashboard opens on that goal's organization, showing just it. Read
 * from `window.location` (no router in this package), once per page load.
 */
export function goalFromUrl(): string | null {
  try {
    return new URLSearchParams(window.location.search).get("goal");
  } catch {
    return null;
  }
}

export const HIDDEN_METRICS_KEY = "goalnexa:dashboard-hidden-metrics";
/** "As logged" (none) or a period the charts snap to - remembered per browser. */
export const SNAP_KEY = "goalnexa:dashboard-snap";
export const SHOWN_GOALS_KEY = "goalnexa:dashboard-shown-goals";

/** What the shown goals are remembered under: org + cycle, + team when one is picked (the old key otherwise). */
export function shownKey(orgKey: string | null, cycleKey: string, teamKey: string): string {
  return `${orgKey}|${cycleKey}${teamKey ? `|${teamKey}` : ""}`;
}

/** The shown goals (id -> color slot) remembered for an org + cycle, or null if never chosen. */
export function readShown(scope: string): Map<string, number> | null {
  const stored = readStored<Record<string, [string, number][]>>(SHOWN_GOALS_KEY, {})[scope];
  return Array.isArray(stored) ? new Map(stored) : null;
}

export function writeShown(scope: string, shown: Map<string, number>) {
  writeStored(SHOWN_GOALS_KEY, { ...readStored<Record<string, unknown>>(SHOWN_GOALS_KEY, {}), [scope]: [...shown] });
}

/** Lowest color slot (1-8) not already held by a selected goal. */
export function freeSlot(slots: Map<string, number>): number {
  const taken = new Set(slots.values());
  for (let slot = 1; slot <= MAX_GOALS; slot += 1) if (!taken.has(slot)) return slot;
  return MAX_GOALS;
}
