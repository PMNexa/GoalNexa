import { useState, type SubmitEvent } from "react";
import { Button, FormControl, FormLabel, Modal } from "platform-core";
import { apiFetch } from "../../lib/api/client";
import type { CheckIn } from "../../lib/api/checkIns";
import type { Metric } from "../../lib/api/metrics";

export interface CheckInModalProps {
  accessToken: string;
  /** The metric being checked in; `null` = closed. */
  metric: Metric | null;
  goalTitle?: string;
  onSaved: () => void;
  onClose: () => void;
}

function formatAmount(value: string): string {
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/**
 * Log a check-in for one metric from the dashboard, in platform-core's
 * `Modal`. Same payload rules as `MetricCheckInsSection`'s form: a blank
 * time is left out so the server default (now) applies. The form's
 * fields reset each time it opens (`key` on the inner form).
 */
function CheckInModal({ accessToken, metric, goalTitle, onSaved, onClose }: CheckInModalProps) {
  return (
    <Modal
      open={metric !== null}
      onClose={onClose}
      size="sm"
      title={metric ? `Check in: ${metric.name}` : ""}
      footer={
        <>
          <Button variant="secondary" outline onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" form="dashboard-check-in-form">
            Save check-in
          </Button>
        </>
      }
    >
      {metric && (
        <CheckInForm key={metric.id} accessToken={accessToken} metric={metric} goalTitle={goalTitle} onSaved={onSaved} />
      )}
    </Modal>
  );
}

function CheckInForm({
  accessToken,
  metric,
  goalTitle,
  onSaved,
}: {
  accessToken: string;
  metric: Metric;
  goalTitle?: string;
  onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<CheckIn>("/api/v1/check-ins", accessToken, {
        method: "POST",
        body: JSON.stringify({
          metric: metric.id,
          value: Number(value),
          note,
          ...(when ? { checked_in_at: new Date(when).toISOString() } : {}),
        }),
      });
      onSaved();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown));
      setSubmitting(false);
    }
  }

  return (
    <form id="dashboard-check-in-form" onSubmit={handleSubmit}>
      <p className="text-secondary mb-3">
        {goalTitle && <>{goalTitle} · </>}
        now {formatAmount(metric.current_value)} of {formatAmount(metric.target_value)}
        {metric.unit ? ` ${metric.unit}` : ""}
      </p>
      <div className="mb-3">
        <FormLabel htmlFor="dashboard-check-in-value" required>
          Value{metric.unit ? ` (${metric.unit})` : ""}
        </FormLabel>
        <FormControl
          id="dashboard-check-in-value"
          type="number"
          step="any"
          required
          autoFocus
          value={value}
          onChange={(event) => setValue(event.target.value)}
        />
      </div>
      <div className="mb-3">
        <FormLabel htmlFor="dashboard-check-in-when">When</FormLabel>
        <FormControl id="dashboard-check-in-when" type="datetime-local" value={when} onChange={(event) => setWhen(event.target.value)} />
        <small className="form-hint">Leave blank for now.</small>
      </div>
      <div>
        <FormLabel htmlFor="dashboard-check-in-note">Note</FormLabel>
        <FormControl id="dashboard-check-in-note" value={note} onChange={(event) => setNote(event.target.value)} />
      </div>
      {error && (
        <p className="text-danger mt-3 mb-0" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

export default CheckInModal;
