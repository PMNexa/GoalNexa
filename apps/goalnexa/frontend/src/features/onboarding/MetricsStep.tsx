import { Button, FormControl, Icon } from "platform-core";
import { newMetric, type GoalDraft, type MetricDraft } from "./onboardingDrafts";

export interface MetricsStepProps {
  goals: GoalDraft[];
  /** Draft keys of metrics already created (a failed create's retry) - locked. */
  locked: { has: (key: number) => boolean };
  onUpdateGoal: (key: number, patch: Partial<GoalDraft>) => void;
  onUpdateMetric: (goalKey: number, metricKey: number, patch: Partial<MetricDraft>) => void;
}

/** The website path's metrics: per goal, each metric's name, unit, start and target. */
function MetricsStep({ goals, locked, onUpdateGoal, onUpdateMetric }: MetricsStepProps) {
  return (
    <div>
      <h3 className="card-title">How will you measure each goal?</h3>
      <p className="text-secondary">
        A metric goes from a start value to a target (down works too - e.g. churn from 8% to 3%). A goal's progress is the average of its metrics.
      </p>
      {goals.map((goal) => (
        <fieldset key={goal.key} className="mb-4">
          <legend className="fs-4 fw-bold mb-2">{goal.title}</legend>
          <div className="row g-2 text-secondary small d-none d-md-flex mb-1">
            <div className="col">Metric</div>
            <div className="col-2">Unit</div>
            <div className="col-2">Start</div>
            <div className="col-2">Target</div>
            <div className="col-auto" style={{ width: "2.5rem" }} />
          </div>
          {goal.metrics.map((metric) => {
            const isLocked = locked.has(metric.key);
            const id = `onboarding-metric-${metric.key}`;
            return (
              <div key={metric.key} className="row g-2 align-items-center mb-3">
                <div className="col-12 col-md">
                  <label className="visually-hidden" htmlFor={`${id}-name`}>Metric name</label>
                  <FormControl
                    id={`${id}-name`}
                    placeholder="e.g. Monthly revenue"
                    value={metric.name}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { name: event.target.value })}
                  />
                </div>
                <div className="col-4 col-md-2">
                  <label className="visually-hidden" htmlFor={`${id}-unit`}>Unit</label>
                  <FormControl
                    id={`${id}-unit`}
                    placeholder="unit"
                    value={metric.unit}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { unit: event.target.value })}
                  />
                </div>
                <div className="col-3 col-md-2">
                  <label className="visually-hidden" htmlFor={`${id}-base`}>Start value</label>
                  <FormControl
                    id={`${id}-base`}
                    type="number"
                    step="any"
                    placeholder="start"
                    value={metric.base}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { base: event.target.value })}
                  />
                </div>
                <div className="col-3 col-md-2">
                  <label className="visually-hidden" htmlFor={`${id}-target`}>Target value</label>
                  <FormControl
                    id={`${id}-target`}
                    type="number"
                    step="any"
                    placeholder="target"
                    value={metric.target}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { target: event.target.value })}
                  />
                </div>
                <div className="col-auto">
                  <Button
                    icon
                    outline
                    variant="secondary"
                    aria-label={`Remove metric ${metric.name || ""}`.trim()}
                    disabled={goal.metrics.length === 1 || isLocked}
                    onClick={() => onUpdateGoal(goal.key, { metrics: goal.metrics.filter((m) => m.key !== metric.key) })}
                  >
                    <Icon name="trash" />
                  </Button>
                </div>
                <div className="col-12">
                  <label className="visually-hidden" htmlFor={`${id}-desc`}>Metric description</label>
                  <FormControl
                    id={`${id}-desc`}
                    placeholder="Description (optional) - how it's measured"
                    value={metric.description}
                    disabled={isLocked}
                    onChange={(event) => onUpdateMetric(goal.key, metric.key, { description: event.target.value })}
                  />
                </div>
              </div>
            );
          })}
          <Button
            variant="link"
            className="px-0"
            onClick={() => onUpdateGoal(goal.key, { metrics: [...goal.metrics, newMetric()] })}
          >
            <Icon name="plus" /> Add metric
          </Button>
        </fieldset>
      ))}
    </div>
  );
}

export default MetricsStep;
