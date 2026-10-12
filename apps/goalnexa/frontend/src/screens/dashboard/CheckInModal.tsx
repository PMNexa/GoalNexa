import { useEffect, useRef, useState, type SubmitEvent } from "react";
import { Button, FormControl, FormLabel, Modal } from "platform-core";
import { apiRequest } from "../../lib/api/client";
import type { CheckIn } from "../../lib/api/checkIns";
import type { Metric } from "../../lib/api/metrics";
import { nextPeriodStart, periodStart, type Snap } from "../../lib/periods";

const THIS_PERIOD: Record<Snap, string> = {
  day: "today",
  week: "this week",
  month: "this month",
  quarter: "this quarter",
  year: "this year",
};
const THAT_PERIOD: Record<Snap, string> = {
  day: "that day",
  week: "that week",
  month: "that month",
  quarter: "that quarter",
  year: "that year",
};

const timeOfDay = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const shortDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * The check-in that counts for the period `t` falls in (one reading per
 * period): the latest of that period, or null. `undefined` while loading.
 */
function usePeriodCheckIn(
  accessToken: string,
  metric: Metric,
  t: number,
  onLoaded: (checkIn: CheckIn | null) => void,
): CheckIn | null | undefined {
  const loadedRef = useRef(onLoaded);
  useEffect(() => {
    loadedRef.current = onLoaded;
  });
  const per = metric.one_per || null;
  const start = per ? periodStart(t, per) : 0;
  const [found, setFound] = useState<{ start: number; checkIn: CheckIn | null } | null>(null);
  useEffect(() => {
    if (!per) return;
    let live = true;
    apiRequest<{ items: CheckIn[] }>("/api/v1/check-ins", accessToken, {
      params: {
        "filter{metric}": metric.id,
        "filter{checked_in_at.gte}": new Date(start).toISOString(),
        "filter{checked_in_at.lt}": new Date(nextPeriodStart(start, per)).toISOString(),
        sort: "-checked_in_at",
        page_size: 1,
      },
    })
      .then((page) => {
        if (!live) return;
        setFound({ start, checkIn: page.items[0] ?? null });
        loadedRef.current(page.items[0] ?? null);
      })
      .catch(() => live && setFound({ start, checkIn: null }));
    return () => {
      live = false;
    };
  }, [accessToken, metric.id, per, start]);
  if (!per) return null;
  return found && found.start === start ? found.checkIn : undefined;
}

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
 * `Modal`. For a `sum` metric the value is an amount to add, and the form
 * says so (with the total it makes). A blank time is left out so the server default (now) applies. The form's
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
  const adds = metric.aggregation === "sum";
  // One reading per period: this check-in replaces the period's earlier one.
  const per = metric.one_per || null;
  const [openedAt] = useState(() => Date.now());
  const at = when ? new Date(when).getTime() : openedAt;
  // The first period's check-in fills the field in, if it's still empty.
  const prefilled = useRef(false);
  const existing = usePeriodCheckIn(accessToken, metric, at, (checkIn) => {
    if (checkIn && !prefilled.current) setValue((current) => (current === "" ? String(Number(checkIn.value)) : current));
    prefilled.current = true;
  });
  const periodWord = per ? (when ? THAT_PERIOD[per] : THIS_PERIOD[per]) : "";
  // A later check-in in the same period keeps counting - this one would be replaced at once.
  const later = !!existing && Date.parse(existing.checked_in_at) > at;
  const replacing = !!existing && !later;
  const newTotal =
    value !== "" && Number.isFinite(Number(value))
      ? Number(metric.current_value) + Number(value) - (replacing && when === "" ? Number(existing.value) : 0)
      : null;

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await apiRequest<CheckIn>("/api/v1/check-ins", accessToken, {
        method: "POST",
        data: {
          metric: metric.id,
          value: Number(value),
          note,
          ...(when ? { checked_in_at: new Date(when).toISOString() } : {}),
        },
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
        {Number(metric.base_value) !== 0 && <> · started at {formatAmount(metric.base_value)}</>}
      </p>
      <div className="mb-3">
        <FormLabel htmlFor="dashboard-check-in-value" required>
          {adds ? (per ? `Total so far ${periodWord}` : "Amount to add") : "Value"}
          {metric.unit ? ` (${metric.unit})` : ""}
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
        {existing && (
          <small className="form-hint">
            {later
              ? `${formatAmount(existing.value)} at ${shortDate.format(Date.parse(existing.checked_in_at))} is later in ${periodWord} and keeps counting - this one won't.`
              : `Replaces ${periodWord === "today" ? "today's" : `${periodWord}'s`} ${formatAmount(existing.value)} (${(when ? shortDate : timeOfDay).format(Date.parse(existing.checked_in_at))})`}
            {!later && adds && newTotal !== null && when === "" ? ` - new total ${formatAmount(String(newTotal))}` : ""}
            {!later ? "." : ""}
          </small>
        )}
        {adds && !existing && (
          <small className="form-hint">
            {per ? `The total ${periodWord}; a later check-in ${periodWord} replaces it` : "Adds to the total"}
            {newTotal !== null && when === "" ? ` - new total ${formatAmount(String(newTotal))}` : ""}.
          </small>
        )}
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
