import { useRef, useState, type SubmitEvent } from "react";
import { Button, Card, CardBody, FormControl, FormLabel, Icon } from "platform-core";
import { createGoal, createMetric, createOrg } from "../../lib/api/onboarding";

interface MetricDraft {
  key: number;
  name: string;
  unit: string;
  base: string;
  target: string;
}

interface GoalDraft {
  key: number;
  title: string;
  targetDate: string;
  metrics: MetricDraft[];
}

const STEPS = ["Organization", "Goals", "Metrics", "Review"] as const;

let nextKey = 1;
const newMetric = (): MetricDraft => ({ key: nextKey++, name: "", unit: "", base: "0", target: "" });
const newGoal = (): GoalDraft => ({ key: nextKey++, title: "", targetDate: "", metrics: [newMetric()] });

type Created = { org: string | null; goals: Map<number, string>; metrics: Set<number> };
const emptyCreated = (): Created => ({ org: null, goals: new Map(), metrics: new Set() });

/** Why a metric can't be saved yet, or `null`. Progress divides by `target - base`, so they must differ. */
function metricProblem(metric: MetricDraft): string | null {
  if (!metric.name.trim()) return "Every metric needs a name.";
  if (metric.target.trim() === "" || Number.isNaN(Number(metric.target))) return `"${metric.name}" needs a target.`;
  if (Number.isNaN(Number(metric.base || "0"))) return `"${metric.name}" has an invalid start value.`;
  if (Number(metric.target) === Number(metric.base || "0")) return `"${metric.name}": the target must differ from the start value.`;
  return null;
}

function stepProblem(step: number, orgName: string, goals: GoalDraft[]): string | null {
  if (step === 0) return orgName.trim() ? null : "Give your organization a name.";
  if (step === 1) {
    if (goals.length === 0) return "Add at least one goal.";
    return goals.every((goal) => goal.title.trim()) ? null : "Every goal needs a title.";
  }
  if (step === 2) {
    for (const goal of goals) {
      if (goal.metrics.length === 0) return `"${goal.title}" needs at least one metric.`;
      for (const metric of goal.metrics) {
        const problem = metricProblem(metric);
        if (problem) return problem;
      }
    }
  }
  return null;
}

function formatAmount(value: string): string {
  return Number(value || "0").toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export interface OnboardingWizardProps {
  accessToken: string;
  /** Everything was created - the new org's id. */
  onComplete: (orgId: string) => void;
  /** "Skip for now" - the host decides whether to ask again. */
  onSkip: () => void;
}

/**
 * First-run onboarding for a user with no organization: name an org, add
 * its goals, then each goal's metrics (start value -> target), review,
 * create. Nothing is written until the last step; a failed create can be
 * retried without duplicating what already went through (`created`).
 * Self-contained like every screen in this package - `accessToken` in,
 * no router dependency.
 */
function OnboardingWizard({ accessToken, onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [orgName, setOrgName] = useState("");
  const [goals, setGoals] = useState<GoalDraft[]>(() => [newGoal()]);
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // What a previous, partly failed create already made (draft key -> id).
  // The create loop writes the ref as it goes; render reads `kept`, a
  // copy taken when a create fails.
  const created = useRef<Created>(emptyCreated());
  const [kept, setKept] = useState<Created>(emptyCreated);
  const started = kept.org !== null;

  function updateGoal(key: number, patch: Partial<GoalDraft>) {
    setGoals((prev) => prev.map((goal) => (goal.key === key ? { ...goal, ...patch } : goal)));
  }

  function updateMetric(goalKey: number, metricKey: number, patch: Partial<MetricDraft>) {
    setGoals((prev) =>
      prev.map((goal) =>
        goal.key === goalKey
          ? { ...goal, metrics: goal.metrics.map((metric) => (metric.key === metricKey ? { ...metric, ...patch } : metric)) }
          : goal,
      ),
    );
  }

  async function createAll() {
    setSubmitting(true);
    setProblem(null);
    const done = created.current;
    try {
      done.org ??= (await createOrg(accessToken, orgName.trim())).id;
      for (const goal of goals) {
        let goalId = done.goals.get(goal.key);
        if (!goalId) {
          goalId = (await createGoal(accessToken, { title: goal.title.trim(), org_id: done.org, target_date: goal.targetDate || null })).id;
          done.goals.set(goal.key, goalId);
        }
        for (const metric of goal.metrics) {
          if (done.metrics.has(metric.key)) continue;
          await createMetric(accessToken, {
            goal: goalId,
            name: metric.name.trim(),
            unit: metric.unit.trim(),
            base_value: Number(metric.base || "0"),
            target_value: Number(metric.target),
          });
          done.metrics.add(metric.key);
        }
      }
      onComplete(done.org);
    } catch (thrown) {
      setKept({ org: done.org, goals: new Map(done.goals), metrics: new Set(done.metrics) });
      setProblem(`${thrown instanceof Error ? thrown.message : String(thrown)} - fix it and try again; what was already created is kept.`);
      setSubmitting(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = stepProblem(step, orgName, goals);
    setProblem(found);
    if (found) return;
    if (step < STEPS.length - 1) setStep(step + 1);
    else void createAll();
  }

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-9 col-xl-8">
        <div className="text-center mb-4">
          <h2 className="mb-1">Welcome to GoalNexa</h2>
          <p className="text-secondary mb-0">Set up your organization and what it's working toward - it takes a minute.</p>
        </div>
        <div className="steps steps-counter mb-4">
          {STEPS.map((label, i) => (
            <span key={label} className={`step-item${i === step ? " active" : ""}`}>
              {label}
            </span>
          ))}
        </div>
        <Card>
          <CardBody>
            <form onSubmit={handleSubmit} noValidate>
              {step === 0 && (
                <div>
                  <h3 className="card-title">Name your organization</h3>
                  <p className="text-secondary">Your team, company or household - goals belong to it, and you can invite others later.</p>
                  <FormLabel htmlFor="onboarding-org" required>
                    Organization name
                  </FormLabel>
                  <FormControl
                    id="onboarding-org"
                    autoFocus
                    placeholder="e.g. Acme Inc."
                    value={orgName}
                    disabled={started}
                    onChange={(event) => setOrgName(event.target.value)}
                  />
                </div>
              )}

              {step === 1 && (
                <div>
                  <h3 className="card-title">What are you aiming for?</h3>
                  <p className="text-secondary">Add a few goals. A target date is optional, but it lets the dashboard project whether you'll make it.</p>
                  {goals.map((goal, i) => (
                    <div key={goal.key} className="row g-2 align-items-end mb-2">
                      <div className="col">
                        <FormLabel htmlFor={`onboarding-goal-${goal.key}`} required={i === 0}>
                          {i === 0 ? "Goal" : <span className="visually-hidden">Goal</span>}
                        </FormLabel>
                        <FormControl
                          id={`onboarding-goal-${goal.key}`}
                          autoFocus={i === 0}
                          placeholder={i === 0 ? "e.g. Grow monthly revenue" : "Another goal"}
                          value={goal.title}
                          disabled={kept.goals.has(goal.key)}
                          onChange={(event) => updateGoal(goal.key, { title: event.target.value })}
                        />
                      </div>
                      <div className="col-4 col-md-3">
                        <FormLabel htmlFor={`onboarding-goal-date-${goal.key}`}>
                          {i === 0 ? "Target date" : <span className="visually-hidden">Target date</span>}
                        </FormLabel>
                        <FormControl
                          id={`onboarding-goal-date-${goal.key}`}
                          type="date"
                          value={goal.targetDate}
                          disabled={kept.goals.has(goal.key)}
                          onChange={(event) => updateGoal(goal.key, { targetDate: event.target.value })}
                        />
                      </div>
                      <div className="col-auto">
                        <Button
                          icon
                          outline
                          variant="secondary"
                          aria-label={`Remove goal ${goal.title || i + 1}`}
                          disabled={goals.length === 1 || kept.goals.has(goal.key)}
                          onClick={() => setGoals((prev) => prev.filter((g) => g.key !== goal.key))}
                        >
                          <Icon name="trash" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <Button variant="link" className="px-0" onClick={() => setGoals((prev) => [...prev, newGoal()])}>
                    <Icon name="plus" /> Add goal
                  </Button>
                </div>
              )}

              {step === 2 && (
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
                        const locked = kept.metrics.has(metric.key);
                        const id = `onboarding-metric-${metric.key}`;
                        return (
                          <div key={metric.key} className="row g-2 align-items-center mb-2">
                            <div className="col-12 col-md">
                              <label className="visually-hidden" htmlFor={`${id}-name`}>Metric name</label>
                              <FormControl
                                id={`${id}-name`}
                                placeholder="e.g. Monthly revenue"
                                value={metric.name}
                                disabled={locked}
                                onChange={(event) => updateMetric(goal.key, metric.key, { name: event.target.value })}
                              />
                            </div>
                            <div className="col-4 col-md-2">
                              <label className="visually-hidden" htmlFor={`${id}-unit`}>Unit</label>
                              <FormControl
                                id={`${id}-unit`}
                                placeholder="unit"
                                value={metric.unit}
                                disabled={locked}
                                onChange={(event) => updateMetric(goal.key, metric.key, { unit: event.target.value })}
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
                                disabled={locked}
                                onChange={(event) => updateMetric(goal.key, metric.key, { base: event.target.value })}
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
                                disabled={locked}
                                onChange={(event) => updateMetric(goal.key, metric.key, { target: event.target.value })}
                              />
                            </div>
                            <div className="col-auto">
                              <Button
                                icon
                                outline
                                variant="secondary"
                                aria-label={`Remove metric ${metric.name || ""}`.trim()}
                                disabled={goal.metrics.length === 1 || locked}
                                onClick={() => updateGoal(goal.key, { metrics: goal.metrics.filter((m) => m.key !== metric.key) })}
                              >
                                <Icon name="trash" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                      <Button
                        variant="link"
                        className="px-0"
                        onClick={() => updateGoal(goal.key, { metrics: [...goal.metrics, newMetric()] })}
                      >
                        <Icon name="plus" /> Add metric
                      </Button>
                    </fieldset>
                  ))}
                </div>
              )}

              {step === 3 && (
                <div>
                  <h3 className="card-title">Ready to go</h3>
                  <p className="text-secondary">
                    This creates <strong>{orgName.trim()}</strong> with {goals.length} goal{goals.length === 1 ? "" : "s"}. You can change
                    anything later, and log progress with check-ins from the dashboard.
                  </p>
                  <ul className="list-unstyled mb-0">
                    {goals.map((goal) => (
                      <li key={goal.key} className="mb-3">
                        <div className="fw-bold">
                          {goal.title}
                          {goal.targetDate && <span className="text-secondary fw-normal"> · by {goal.targetDate}</span>}
                        </div>
                        <ul className="mb-0">
                          {goal.metrics.map((metric) => (
                            <li key={metric.key}>
                              {metric.name}: {formatAmount(metric.base)} → {formatAmount(metric.target)}
                              {metric.unit ? ` ${metric.unit}` : ""}
                            </li>
                          ))}
                        </ul>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {problem && (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {problem}
                </div>
              )}

              <div className="d-flex align-items-center gap-2 mt-4">
                <Button variant="link" className="px-0 text-secondary" onClick={onSkip} disabled={submitting || started}>
                  Skip for now
                </Button>
                <div className="ms-auto d-flex gap-2">
                  {step > 0 && (
                    <Button
                      variant="secondary"
                      outline
                      disabled={submitting}
                      onClick={() => {
                        setProblem(null);
                        setStep(step - 1);
                      }}
                    >
                      Back
                    </Button>
                  )}
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {step < STEPS.length - 1 ? "Next" : submitting ? "Creating…" : "Create and open dashboard"}
                  </Button>
                </div>
              </div>
            </form>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default OnboardingWizard;
