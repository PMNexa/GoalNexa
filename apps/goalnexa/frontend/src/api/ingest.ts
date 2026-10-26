import { apiRequest } from "./client";
import type { Metric } from "./metrics";

/**
 * A metric's ingest token (`/api/v1/metrics/<id>/ingest-token`): the
 * secret a script or webhook checks in with, at
 * `/api/v1/metrics/<id>/ingest`, no login needed. The full token comes
 * back once, on creation - the server keeps only its hash and last
 * characters (`Metric.ingest_token_hint`).
 */
export interface IssuedIngestToken {
  token: string;
  hint: string;
  /** The absolute ingest URL, as the server sees itself. */
  url: string;
}

export function fetchMetric(accessToken: string, metricId: string): Promise<Metric> {
  return apiRequest<Metric>(`/api/v1/metrics/${metricId}`, accessToken);
}

export function issueIngestToken(accessToken: string, metricId: string): Promise<IssuedIngestToken> {
  return apiRequest<IssuedIngestToken>(`/api/v1/metrics/${metricId}/ingest-token`, accessToken, { method: "POST" });
}

export function revokeIngestToken(accessToken: string, metricId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/metrics/${metricId}/ingest-token`, accessToken, { method: "DELETE" });
}
