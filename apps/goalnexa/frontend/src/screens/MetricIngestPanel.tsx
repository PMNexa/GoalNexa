import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, CodeBlock } from "platform-core";
import { errorMessage } from "../lib/api/goalMembers";
import { fetchMetric, issueIngestToken, revokeIngestToken, type IssuedIngestToken } from "../lib/api/ingest";
import type { Metric } from "../lib/api/metrics";

export interface MetricIngestPanelProps {
  accessToken: string;
  metricId: string;
  /** Fires after the token was created, rotated or revoked - e.g. to reload a detail view showing its hint. */
  onChanged?: () => void;
}

function curlExample(url: string, token: string, metric: Metric): string {
  const value = metric.aggregation === "sum" ? 1 : Number(metric.current_value);
  return [
    `curl -X POST ${url} \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"value": ${value}, "note": "from a script"}'`,
  ].join("\n");
}

/**
 * "Automatic check-ins" for one metric: its ingest token - what a script,
 * cron job, Home Assistant automation or any webhook checks in with,
 * without a login (the backend's `views/ingest.py`). The token is shown
 * once, right after it's created or rotated, with a ready-to-run `curl`;
 * afterwards only its last characters. Under a metric's page
 * (`createMetricsRoutes()`) and in the dashboard's metric drawer.
 */
function MetricIngestPanel({ accessToken, metricId, onChanged }: MetricIngestPanelProps) {
  const [metric, setMetric] = useState<Metric | null>(null);
  const [issued, setIssued] = useState<IssuedIngestToken | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchMetric(accessToken, metricId)
      .then((row) => !cancelled && setMetric(row))
      .catch((thrown: unknown) => !cancelled && setError(errorMessage(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, metricId]);

  async function act(run: () => Promise<IssuedIngestToken | void>) {
    setBusy(true);
    setError(null);
    try {
      const result = await run();
      setIssued(result || null);
      setMetric(await fetchMetric(accessToken, metricId));
      onChanged?.();
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  const hint = metric?.ingest_token_hint ?? "";
  const url =
    issued?.url ?? (typeof window === "undefined" ? "" : `${window.location.origin}/api/v1/metrics/${metricId}/ingest`);

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Automatic check-ins</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-secondary">
          Send {metric?.aggregation === "sum" ? "amounts to add" : "readings"} from a script, a cron job, Home Assistant,
          n8n or any webhook - no login. The token can only add check-ins to this metric.
        </p>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {metric === null ? (
          !error && <div className="text-secondary">Loading…</div>
        ) : issued ? (
          <>
            <div className="alert alert-warning">Copy the token now - it won't be shown again.</div>
            <CodeBlock code={curlExample(issued.url, issued.token, metric)} />
            <small className="form-hint mt-2">
              Optional fields: <code>note</code>, <code>checked_in_at</code> (ISO 8601). A sender that can't set headers
              may add <code>?token=…</code> to the URL instead.
            </small>
          </>
        ) : hint ? (
          <p className="mb-0">
            Active token ending in <code>…{hint}</code>, posting to <code>{url}</code>
          </p>
        ) : (
          <p className="mb-0 text-secondary">No token yet.</p>
        )}
      </CardBody>
      {metric !== null && (
        <CardBody className="border-top d-flex gap-2">
          <Button variant="primary" disabled={busy} onClick={() => void act(() => issueIngestToken(accessToken, metricId))}>
            {hint ? "Rotate token" : "Create token"}
          </Button>
          {hint && (
            <Button variant="danger" outline disabled={busy} onClick={() => void act(() => revokeIngestToken(accessToken, metricId))}>
              Revoke
            </Button>
          )}
        </CardBody>
      )}
    </Card>
  );
}

export default MetricIngestPanel;
