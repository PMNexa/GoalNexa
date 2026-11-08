import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode, type SubmitEvent } from "react";
import { Button, Card, CardBody, createRequest, createSchemaFields, loadSchema, useT, type CrudField } from "platform-core";
import { browserTimeZone, createGoal, createMetric, createOrg, saveOnboardingChoice } from "../../api/onboarding";
import { fetchReminderSettings, patchReminderSettings } from "../../api/reminders";
import AgentSteps from "./AgentSteps";
import AudienceStep from "./AudienceStep";
import GoalsStep from "./GoalsStep";
import MetricsStep from "./MetricsStep";
import ModeChoice from "./ModeChoice";
import OrgNameStep from "./OrgNameStep";
import messages from "./messages";
import ReviewStep from "./ReviewStep";
import {
  AGENT_STEPS,
  emptyCreated,
  newGoal,
  stepProblem,
  webSteps,
  type Audience,
  type Created,
  type GoalDraft,
  type MetricDraft,
  type Mode,
} from "./onboardingDrafts";

const SKILLS_PATH = "/api/v1/mcp/skills";
const subscribeNever = () => () => {};
const absoluteSkillsUrl = () => new URL(SKILLS_PATH, window.location.origin).toString();
type Field = CrudField<Record<string, unknown>>;
const MOMENT_KEYS = ["snap_weekday", "snap_quarter_month", "snap_month", "snap_day", "snap_time"];

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
 * - the website: who it's for (just me = personal goals, no org; my team =
 *   name an org), its goals with how often they're checked in (frequency;
 *   metrics inherit it), then each goal's metrics (start value -> target),
 *   review - with "email me when a check-in is due" -, create. Nothing is written until the
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
  const t = useT(messages);
  const [mode, setMode] = useState<Mode | null>(null);
  const [audience, setAudience] = useState<Audience | null>(null);
  // With an existing org, "who" and naming one are skipped.
  const steps = webSteps(Boolean(existingOrg), audience);
  const [step, setStep] = useState(0);
  const stepName = steps[step];
  // The goal schema's frequency field and moment fields (labels from the server).
  const [frequencyField, setFrequencyField] = useState<Field | undefined>();
  const [momentFields, setMomentFields] = useState<Partial<Record<string, Field>>>({});
  // "Email me when a check-in is due": offered only when the instance sends email.
  const [remind, setRemind] = useState<boolean | undefined>();
  const request = useMemo(() => createRequest(accessToken), [accessToken]);
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

  useEffect(() => {
    if (mode !== "web") return;
    let cancelled = false;
    loadSchema("/api/v1/goals", request)
      .then((schema) => {
        if (cancelled) return;
        const fields = createSchemaFields<Record<string, unknown>>(schema);
        const snap = fields.find((field) => field.key === "snap_to");
        // A top-level goal has no parent to follow.
        if (snap)
          setFrequencyField({
            ...snap,
            label: t("frequency"),
            helpText: t("frequencyHint"),
            options: snap.options?.filter((option) => option.value !== "parent"),
          });
        setMomentFields(Object.fromEntries(fields.filter((field) => MOMENT_KEYS.includes(field.key)).map((field) => [field.key, field])));
      })
      // Without the schema no frequency is asked; goals get the server's default.
      .catch(() => undefined);
    fetchReminderSettings(accessToken)
      .then((settings) => !cancelled && settings.email_available && setRemind((prev) => prev ?? true))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // `t` changes only with the language; the labels are read once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, request, accessToken]);

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
      // First, so the goals' schedules are worked out in it: the browser's time zone
      // (personal goals count their days in it, reminders arrive by it), and email
      // reminders if ticked. Best effort - they can be set on the Reminders page.
      const zone = browserTimeZone();
      const change = { ...(remind ? { enabled: true, email: true } : {}), ...(zone ? { timezone: zone } : {}) };
      if (Object.keys(change).length > 0) await patchReminderSettings(accessToken, change).catch(() => undefined);
      const orgId = existingOrg
        ? existingOrg.id
        : audience === "me"
          ? null
          : (done.org ??= (await createOrg(accessToken, orgName.trim())).id);
      for (const goal of goals) {
        let goalId = done.goals.get(goal.key);
        if (!goalId) {
          // The frequency only when it was asked (the schema loaded).
          const frequency = frequencyField ? { snap_to: goal.snapTo, ...goal.moment } : {};
          goalId = (
            await createGoal(accessToken, {
              title: goal.title.trim(),
              description: goal.description.trim(),
              org_id: orgId,
              target_date: goal.targetDate || null,
              ...frequency,
            })
          ).id;
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
      setProblem(t("createFailed", { error: thrown instanceof Error ? thrown.message : String(thrown) }));
      setSubmitting(false);
    }
  }

  function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    const found = stepProblem(stepName, orgName, goals, audience);
    setProblem(found);
    if (found) return;
    if (step < steps.length - 1) setStep(step + 1);
    else void createAll();
  }

  // Before choosing, the steps shown are the recommended (agent) path's.
  const labels = (["start", ...(mode === "web" ? steps : AGENT_STEPS)] as const).map((key) => t(`step_${key}`));
  const current = mode === null ? 0 : 1 + (mode === "agent" ? agentStep : step);

  return (
    <div className="row justify-content-center">
      <div className="col-12 col-lg-9 col-xl-8">
        <div className="text-center mb-4">
          {existingOrg && orgPicker ? (
            <h2 className="mb-1 d-flex justify-content-center align-items-center gap-2 flex-wrap">
              {t("setUpPrefix")} {orgPicker}
            </h2>
          ) : (
            <h2 className="mb-1">{existingOrg ? t("setUp", { name: existingOrg.name }) : t("welcome")}</h2>
          )}
          <p className="text-secondary mb-0">
            {mode === "web"
              ? existingOrg
                ? t("leadExisting")
                : audience === "me"
                  ? t("leadMe")
                  : t("leadWeb")
              : t("leadAgent")}
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
              {stepName === "audience" && (
                <AudienceStep
                  audience={audience}
                  onChoose={(choice) => {
                    setAudience(choice);
                    setProblem(null);
                    setStep(1);
                  }}
                />
              )}

              {stepName === "organization" && <OrgNameStep orgName={orgName} disabled={started} onChange={setOrgName} />}

              {stepName === "goals" && (
                <GoalsStep
                  goals={goals}
                  locked={kept.goals}
                  frequencyField={frequencyField}
                  momentFields={momentFields}
                  onUpdate={updateGoal}
                  onAdd={() => setGoals((prev) => [...prev, newGoal()])}
                  onRemove={(key) => setGoals((prev) => prev.filter((g) => g.key !== key))}
                />
              )}

              {stepName === "metrics" && (
                <MetricsStep goals={goals} locked={kept.metrics} onUpdateGoal={updateGoal} onUpdateMetric={updateMetric} />
              )}

              {stepName === "review" && (
                <ReviewStep
                  goals={goals}
                  orgName={orgName}
                  existingOrg={existingOrg}
                  personal={!existingOrg && audience === "me"}
                  remind={remind}
                  onRemind={setRemind}
                />
              )}

              {problem && (
                <div className="alert alert-danger mt-3 mb-0" role="alert">
                  {problem}
                </div>
              )}

              <div className="d-flex align-items-center gap-2 mt-4">
                <Button variant="link" className="px-0 text-secondary" onClick={onSkip} disabled={submitting || started}>
                  {t("skip")}
                </Button>
                <div className="ms-auto d-flex gap-2">
                  {(step > 0 || !started) && (
                    <Button
                      variant="secondary"
                      outline
                      disabled={submitting}
                      onClick={() => {
                        setProblem(null);
                        if (step > 0) setStep(step - 1);
                        else setMode(null);
                      }}
                    >
                      {t("back")}
                    </Button>
                  )}
                  <Button type="submit" variant="primary" disabled={submitting}>
                    {step < steps.length - 1 ? t("next") : submitting ? t("creating") : t("createAndOpen")}
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
