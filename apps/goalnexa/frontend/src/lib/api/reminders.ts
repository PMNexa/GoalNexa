import { apiRequest } from "./client";
import type { Metric } from "./metrics";

/**
 * The caller's own check-in reminder settings (`/api/v1/reminder-settings`,
 * the backend's `views/reminders.py`): Apprise URLs, one per line.
 */
export interface ReminderSettings {
  enabled: boolean;
  urls: string;
  /** Schemes this instance accepts; `null` = any. */
  allowed_schemes: string[] | null;
}

export function fetchReminderSettings(accessToken: string): Promise<ReminderSettings> {
  return apiRequest<ReminderSettings>("/api/v1/reminder-settings", accessToken);
}

export function saveReminderSettings(accessToken: string, data: { enabled: boolean; urls: string }): Promise<ReminderSettings> {
  return apiRequest<ReminderSettings>("/api/v1/reminder-settings", accessToken, { method: "PUT", data });
}

export function sendTestReminder(accessToken: string): Promise<void> {
  return apiRequest<void>("/api/v1/reminder-settings/test", accessToken, { method: "POST" });
}

/** A due metric with its goal sideloaded (`?include[]=goal`). */
export type DueMetric = Omit<Metric, "goal"> & { goal: { id: string; title: string } };

/** Metrics whose scheduled check-in is due, most overdue first (the first 50). */
export function fetchDueMetrics(accessToken: string): Promise<{ items: DueMetric[]; total: number }> {
  const now = encodeURIComponent(new Date().toISOString());
  return apiRequest(
    `/api/v1/metrics?filter{check_in_due_at.lte}=${now}&include[]=goal&sort=check_in_due_at&page_size=50`,
    accessToken,
  );
}
