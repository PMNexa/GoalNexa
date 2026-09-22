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
import type { Metric } from "../lib/api/metrics";

export interface GoalMetricsSectionProps {
  accessToken: string;
  goalId: string;
}

interface NewMetricForm {
  name: string;
  unit: string;
  target_value: string;
}

const EMPTY_FORM: NewMetricForm = { name: "", unit: "", target_value: "" };

/**
 * Nested metrics list + a lightweight inline "add metric" form for a
 * single goal - lives inside `GoalsEditScreen`, not a full `CrudRouter`
 * screen of its own. A metric only ever needs CREATING/browsing in the
 * context of its goal here; editing/deleting an existing one still goes
 * through the full top-level Metrics screens (see `index.ts`'s
 * `MetricsScreen`/`MetricsEditScreen`) - keeping this section
 * create-and-list-only avoids duplicating that form.
 *
 * Fetches `/api/v1/metrics?filter{goal}=<goalId>` directly
 * (`DynamicFilterBackend`'s exact-match filter syntax - see
 * `core_api.filters`) rather than sideloading via `GoalsScreen`'s
 * `?include[]=metrics`, since this needs its own independent refetch
 * after a create, decoupled from `GoalsEditScreen`'s own form state.
 */
function GoalMetricsSection({ accessToken, goalId }: GoalMetricsSectionProps) {
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [form, setForm] = useState<NewMetricForm>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);

  function load() {
    apiFetch<{ items: Metric[] }>(`/api/v1/metrics?filter{goal}=${goalId}&page_size=100`, accessToken)
      .then((page) => setMetrics(page.items))
      .catch((thrown: unknown) => setError(thrown instanceof Error ? thrown : new Error(String(thrown))));
  }

  useEffect(() => {
    // Synchronizing with an external system (the network) - see
    // platform-core's useDataTable/CrudEditScreen for the same rule
    // applied there.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalId]);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch<Metric>("/api/v1/metrics", accessToken, {
        method: "POST",
        body: JSON.stringify({ ...form, goal: goalId, target_value: Number(form.target_value) }),
      });
      setForm(EMPTY_FORM);
      load();
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown : new Error(String(thrown)));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Metrics</CardTitle>
      </CardHeader>
      <CardBody>
        {error && (
          <p className="text-danger" role="alert">
            {error.message}
          </p>
        )}

        {metrics && metrics.length > 0 && (
          <Table responsive mobileBreakpoint="sm">
            <TableHead>
              <TableRow>
                <TableHeaderCell>Name</TableHeaderCell>
                <TableHeaderCell>Unit</TableHeaderCell>
                <TableHeaderCell>Current</TableHeaderCell>
                <TableHeaderCell>Target</TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {metrics.map((metric) => (
                <TableRow key={metric.id}>
                  <TableCell label="Name">{metric.name}</TableCell>
                  <TableCell label="Unit">{metric.unit}</TableCell>
                  <TableCell label="Current">{metric.current_value}</TableCell>
                  <TableCell label="Target">{metric.target_value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {metrics && metrics.length === 0 && <p className="text-secondary mb-0">No metrics yet.</p>}

        <form onSubmit={handleSubmit} className="d-flex gap-2 align-items-end flex-wrap mt-3">
          <div>
            <FormLabel htmlFor="new-metric-name">Name</FormLabel>
            <FormControl
              id="new-metric-name"
              required
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
            />
          </div>
          <div>
            <FormLabel htmlFor="new-metric-unit">Unit</FormLabel>
            <FormControl
              id="new-metric-unit"
              value={form.unit}
              onChange={(event) => setForm((prev) => ({ ...prev, unit: event.target.value }))}
            />
          </div>
          <div>
            <FormLabel htmlFor="new-metric-target">Target</FormLabel>
            <FormControl
              id="new-metric-target"
              type="number"
              required
              value={form.target_value}
              onChange={(event) => setForm((prev) => ({ ...prev, target_value: event.target.value }))}
            />
          </div>
          <Button type="submit" variant="primary" disabled={submitting}>
            {submitting ? "Adding…" : "Add metric"}
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

export default GoalMetricsSection;
