import { useEffect, useState, type SubmitEvent } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  FormControl,
  FormLabel,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from "platform-core";
import { apiFetch } from "../lib/api/client";
import type { CheckIn } from "../lib/api/checkIns";

export interface MetricCheckInsSectionProps {
  accessToken: string;
  metricId: string;
  /**
   * Fires after a successful create - creating a check-in here also
   * updates this metric's `current_value` server-side
   * (`CheckInViewSet.perform_create`), but this section has no way to
   * push that back into the sibling `CrudEditScreen`'s own already-
   * loaded form state; the host (`MetricsEditScreen`) uses this to force
   * that form to refetch instead - see its own docstring.
   */
  onCheckIn?: () => void;
}

interface NewCheckInForm {
  value: string;
  note: string;
  /** `datetime-local` value; blank = now (the key is left out, server default applies). */
  checkedInAt: string;
}

const EMPTY_FORM: NewCheckInForm = { value: "", note: "", checkedInAt: "" };
const WHEN_FORMAT = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

/**
 * Nested check-ins list + a lightweight inline "add check-in" form for a
 * single metric - same "create-and-list-only here, full edit/delete via
 * the top-level screens" scoping `GoalMetricsSection` uses for a goal's
 * metrics (see its own docstring). Fetches
 * `/api/v1/check-ins?filter{metric}=<metricId>` directly, same reasoning
 * as `GoalMetricsSection`'s own fetch.
 */
function MetricCheckInsSection({ accessToken, metricId, onCheckIn }: MetricCheckInsSectionProps) {
  const [checkIns, setCheckIns] = useState<CheckIn[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [form, setForm] = useState<NewCheckInForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<{ items: CheckIn[] }>(`/api/v1/check-ins?filter{metric}=${metricId}&page_size=100`, accessToken)
      .then((page) => setCheckIns(page.items))
      .catch((thrown: unknown) => setError(thrown instanceof Error ? thrown : new Error(String(thrown))));
  }

  useEffect(() => {
    // Synchronizing with an external system (the network) - see
    // platform-core's useDataTable/CrudEditScreen for the same rule
    // applied there.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metricId]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<CheckIn>("/api/v1/check-ins", accessToken, {
        method: "POST",
        body: JSON.stringify({
          metric: metricId,
          value: Number(form.value),
          note: form.note,
          ...(form.checkedInAt ? { checked_in_at: new Date(form.checkedInAt).toISOString() } : {}),
        }),
      });
      setForm(EMPTY_FORM);
      load();
      onCheckIn?.();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown : new Error(String(thrown)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Check-ins</CardTitle>
      </CardHeader>
      <CardBody>
        {error && (
          <p className="text-danger" role="alert">
            {error.message}
          </p>
        )}

        {checkIns && checkIns.length > 0 && (
          <Table responsive mobileBreakpoint="sm">
            <TableHead>
              <TableRow>
                <TableHeaderCell>When</TableHeaderCell>
                <TableHeaderCell>Value</TableHeaderCell>
                <TableHeaderCell>Note</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {checkIns.map((checkIn) => (
                <TableRow key={checkIn.id}>
                  <TableCell label="When">{WHEN_FORMAT.format(new Date(checkIn.checked_in_at))}</TableCell>
                  <TableCell label="Value">{checkIn.value}</TableCell>
                  <TableCell label="Note">{checkIn.note}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {checkIns && checkIns.length === 0 && <p className="text-secondary mb-0">No check-ins yet.</p>}

        <form onSubmit={handleSubmit} className="d-flex gap-2 align-items-end flex-wrap mt-3">
          <div>
            <FormLabel htmlFor="new-checkin-value">Value</FormLabel>
            <FormControl
              id="new-checkin-value"
              type="number"
              required
              value={form.value}
              onChange={(event) => setForm((prev) => ({ ...prev, value: event.target.value }))}
            />
          </div>
          <div>
            <FormLabel htmlFor="new-checkin-note">Note</FormLabel>
            <FormControl
              id="new-checkin-note"
              value={form.note}
              onChange={(event) => setForm((prev) => ({ ...prev, note: event.target.value }))}
            />
          </div>
          <div>
            <FormLabel htmlFor="new-checkin-when">
              When <span className="text-secondary fw-normal">(blank = now)</span>
            </FormLabel>
            <FormControl
              id="new-checkin-when"
              type="datetime-local"
              value={form.checkedInAt}
              onChange={(event) => setForm((prev) => ({ ...prev, checkedInAt: event.target.value }))}
            />
          </div>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add check-in"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default MetricCheckInsSection;
