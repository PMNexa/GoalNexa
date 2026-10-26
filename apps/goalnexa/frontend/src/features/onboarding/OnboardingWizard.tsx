import { useRef, useState, useSyncExternalStore, type ReactNode, type SubmitEvent } from "react";
import { Button, Card, CardBody } from "platform-core";
import { createGoal, createMetric, createOrg, saveOnboardingChoice } from "../../api/onboarding";
import AgentSteps from "./AgentSteps";
import GoalsStep from "./GoalsStep";
import MetricsStep from "./MetricsStep";
import ModeChoice from "./ModeChoice";
import OrgNameStep from "./OrgNameStep";
import ReviewStep from "./ReviewStep";
import {
  AGENT_STEPS,
  emptyCreated,
  newGoal,
  STEPS,
  stepProblem,
  type Created,
  type GoalDraft,
  type MetricDraft,
  type Mode,
} from "./onboardingDrafts";

const SKILLS_PATH = "/api/v1/mcp/skills";
const subscribeNever = () => () => {};
const absoluteSkillsUrl = () => new URL(SKILLS_PATH, window.location.origin).toString();

export interface OnboardingWizardProps {
  accessToken: string;
  /** Everything was created - the new org's id (the `existingOrg`'s, if given). */
  onComplete: (orgId: string | null) => void;
  /**
   * Set up goals in an organization that already exists (it has none yet):
   * the "Organization" step is left out and nothing creates an org.
   * `id: null` = personal goals.
   */
  existingOrg?: { id: string | null; name: string };
  /** Replaces the org's name in the heading ("Set up <picker>"), e.g. a select to switch to another org. */
  orgPicker?: ReactNode;
  /** "Skip for now" - the host decides whether to ask again. */
  onSkip: () => void;
}

/**
 * First-run onboarding for a user with no organization. It starts by
 * asking how they'll use GoalNexa, and each answer has its own steps:
 * - the website: name an org, add its goals, then each goal's metrics
 *   (start value -> target), review, create. Nothing is written until the
 *   last step; a failed create can be retried without duplicating what
 *   already went through (`created`);
 * - an AI agent: connect it to the MCP server (platform-mcp's
 *   `McpConnectGuide`, per client), install the goalnexa skills, and
 *   prompts to start with - the agent sets up the org and goals itself.
 *   Finishing is `onSkip`: nothing was created here.
 * Self-contained like every screen in this package - `accessToken` in,
 * no router dependency.
 */
function OnboardingWizard({ accessToken, onComplete, onSkip, existingOrg, orgPicker }: OnboardingWizardProps) {
  const [mode, setMode] = useState<Mode | null>(null);
  // With an existing org, the first step (naming one) is skipped.
  const firstStep = existingOrg ? 1 : 0;
  const [step, setStep] = useState(firstStep);
  const [agentStep, setAgentStep] = useState(0);
  const skillsUrl = useSyncExternalStore(subscribeNever, absoluteSkillsUrl, () => SKILLS_PATH);
  const skillsPrompt = `Install the goalnexa skills from ${skillsUrl}`;
  const [orgName, setOrgName] = useState("");
  const [goals, setGoals] = useState<GoalDraft[]>(() => [newGoal()]);
  const [problem, setProblem] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // What a previous, partly failed create already made (draft key -> id).
  // The create loop writes the ref as it goes; render reads `kept`, a
  // copy taken when a create fails.
  const created = useRef<Created>(emptyCreated());
  const [kept, setKept] = useState<Created>(emptyCreated);
  const started = kept.org !== null || kept.goals.size > 0;

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
      const orgId = existingOrg ? existingOrg.id : (done.org ??= (await createOrg(accessToken, orgName.trim())).id);
      for (const goal of goals) {
        let goalId = done.goals.get(goal.key);
        if (!goalId) {
          goalId = (await createGoal(accessToken, { title: goal.title.trim(), description: goal.description.trim(), org_id: orgId, target_date: goal.targetDate || null })).id;
          done.goals.set(goal.key, goalId);
        }
        for (const metric of goal.metrics) {
          if (done.metrics.has(metric.key)) continue;
          await createMetric(accessToken, {
            goal: goalId,
            name: metric.name.trim(),
            description: metric.description.trim(),
            unit: metric.unit.trim(),
            base_value: Number(metric.base || "0"),
            target_value: Number(metric.target),
          });
          done.metrics.add(metric.key);
        }
      }
      onComplete(orgId);
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

  // Before choosing, the steps shown are the recommended (agent) path's.
  const webSteps = STEPS.slice(firstStep);
  const labels = ["Get started", ...(mode === "web" ? webSteps : AGENT_STEPS)];
  const current = mode === null ? 0 : 1 + (mode === "agent" ? agentStep : step - firstStep);

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-9 col-xl-8">
        <div className="text-center mb-4">
          {existingOrg && orgPicker ? (
            <h2 className="mb-1 d-flex justify-content-center align-items-center gap-2 flex-wrap">
              Set up {orgPicker}
            </h2>
          ) : (
            <h2 className="mb-1">{existingOrg ? `Set up ${existingOrg.name}` : "Welcome to GoalNexa"}</h2>
          )}
          <p className="text-secondary mb-0">
            {mode === "web"
              ? existingOrg
                ? "Add what it's working toward - it takes a minute."
                : "Set up your organization and what it's working toward - it takes a minute."
              : "Connect your AI assistant - then just tell it what you're working toward."}
          </p>
        </div>
        <div className="steps steps-counter mb-4">
          {labels.map((label, i) => (
            <span key={label} className={`step-item${i === current ? " active" : ""}`}>
              {label}
            </span>
          ))}
        </div>
        <Card>
          <CardBody>
            {mode === null ? (
              <ModeChoice
                onChoose={(choice) => {
                  setMode(choice);
                  // Best effort - only the admin's funnel reads it.
                  saveOnboardingChoice(accessToken, choice).catch(() => {});
                }}
                onSkip={onSkip}
              />
            ) : mode === "agent" ? (
              <AgentSteps
                accessToken={accessToken}
                step={agentStep}
                skillsPrompt={skillsPrompt}
                skillsUrl={skillsUrl}
                onStep={setAgentStep}
                onBack={() => (agentStep > 0 ? setAgentStep(agentStep - 1) : setMode(null))}
                onDone={onSkip}
              />
            ) : (
            <form onSubmit={handleSubmit} noValidate>
              {step === 0 && <OrgNameStep orgName={orgName} disabled={started} onChange={setOrgName} />}

              {step === 1 && (
                <GoalsStep
                  goals={goals}
                  locked={kept.goals}
                  onUpdate={updateGoal}
                  onAdd={() => setGoals((prev) => [...prev, newGoal()])}
                  onRemove={(key) => setGoals((prev) => prev.filter((g) => g.key !== key))}
                />
              )}

              {step === 2 && (
                <MetricsStep goals={goals} locked={kept.metrics} onUpdateGoal={updateGoal} onUpdateMetric={updateMetric} />
              )}

              {step === 3 && <ReviewStep goals={goals} orgName={orgName} existingOrg={existingOrg} />}

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
                  {(step > firstStep || !started) && (
                    <Button
                      variant="secondary"
                      outline
                      disabled={submitting}
                      onClick={() => {
                        setProblem(null);
                        if (step > firstStep) setStep(step - 1);
                        else setMode(null);
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
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

export default OnboardingWizard;
