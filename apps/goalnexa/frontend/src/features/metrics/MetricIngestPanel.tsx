import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, CodeBlock, useT } from "platform-core";
import { errorMessage } from "../../api/goalMembers";
import { fetchMetric, issueIngestToken, revokeIngestToken, type IssuedIngestToken } from "../../api/ingest";
import type { Metric } from "../../api/metrics";
import messages from "./MetricIngestPanel.messages";

export interface MetricIngestPanelProps {
  accessToken: string;
  metricId: string;
  /** Fires after the token was created, rotated or revoked - e.g. to reload a detail view showing its hint. */
  onChanged?: () => void;
}

function curlExample(url: string, token: string, metric: Metric, note: string): string {
  const value = metric.aggregation === "sum" ? 1 : Number(metric.current_value);
  return [
    `curl -X POST ${url} \\`,
    `  -H "Authorization: Bearer ${token}" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '{"value": ${value}, "note": ${JSON.stringify(note)}}'`,
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
  const t = useT(messages);
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
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-secondary">
          {t(metric?.aggregation === "sum" ? "introSum" : "introReading")}
        </p>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {metric === null ? (
          !error && <div className="text-secondary">{t("loading")}</div>
        ) : issued ? (
          <>
            <div className="alert alert-warning">{t("copyNow")}</div>
            <CodeBlock code={curlExample(issued.url, issued.token, metric, t("curlNote"))} />
            <small className="form-hint mt-2">
              {t.rich("optional", {})}
            </small>
          </>
        ) : hint ? (
          <p className="mb-0">
            {t.rich("active", { hint, url })}
          </p>
        ) : (
          <p className="mb-0 text-secondary">{t("noToken")}</p>
        )}
      </CardBody>
      {metric !== null && (
        <CardBody className="border-top d-flex gap-2">
          <Button variant="primary" disabled={busy} onClick={() => void act(() => issueIngestToken(accessToken, metricId))}>
            {hint ? t("rotate") : t("create")}
          </Button>
          {hint && (
            <Button variant="danger" outline disabled={busy} onClick={() => void act(() => revokeIngestToken(accessToken, metricId))}>
              {t("revoke")}
            </Button>
          )}
        </CardBody>
      )}
    </Card>
  );
}

export default MetricIngestPanel;
