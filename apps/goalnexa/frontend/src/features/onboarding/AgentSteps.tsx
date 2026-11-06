import { Button, CopyButton, FormControl, useT } from "platform-core";
import { McpConnectGuide } from "platform-mcp-frontend";
import messages from "./messages";
import { AGENT_STEPS } from "./onboardingDrafts";

/** What to say to the agent first - each maps to one of goalnexa's skills. */
const STARTER_PROMPTS = [
  { skill: "skillPlan", prompt: "promptPlan" },
  { skill: "skillCheckIn", prompt: "promptCheckIn" },
  { skill: "skillReview", prompt: "promptReview" },
] as const;

export interface AgentStepsProps {
  accessToken: string;
  /** 0-2: Connect, Skills, Try it. */
  step: number;
  skillsPrompt: string;
  skillsUrl: string;
  onStep: (step: number) => void;
  onBack: () => void;
  onDone: () => void;
}

/**
 * The AI-agent path: connect it (platform-mcp's `McpConnectGuide`), install
 * the goalnexa skills, starter prompts. Finishing is `onDone` - the agent
 * creates the org and goals itself.
 */
function AgentSteps({
  accessToken,
  step,
  skillsPrompt,
  skillsUrl,
  onStep,
  onBack,
  onDone,
}: AgentStepsProps) {
  const t = useT(messages);
  const last = step === AGENT_STEPS.length - 1;
  return (
    <div>
      {step === 0 && (
        <div>
          <h3 className="card-title">{t("connectTitle")}</h3>
          <p className="text-secondary">
            {t("connectHint")}
          </p>
          <McpConnectGuide accessToken={accessToken} tokenName="Onboarding" />
        </div>
      )}

      {step === 1 && (
        <div>
          <h3 className="card-title">{t("skillsTitle")}</h3>
          <p className="text-secondary">
            {t("skillsHint")}
          </p>
          <div className="d-flex gap-2">
            <FormControl readOnly value={skillsPrompt} aria-label={t("skillsPromptLabel")} onFocus={(event) => event.target.select()} />
            <CopyButton text={skillsPrompt} />
          </div>
          <small className="form-hint">
            <a href={skillsUrl} target="_blank" rel="noreferrer">
              {t("skillsSee")}
            </a>
          </small>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="card-title">{t("tryTitle")}</h3>
          <p className="text-secondary">
            {t("tryHint")}
          </p>
          <ul className="list-unstyled mb-0">
            {STARTER_PROMPTS.map(({ skill, prompt }) => (
              <li key={skill} className="d-flex align-items-center gap-2 mb-2">
                <span className="badge bg-secondary-lt" style={{ minWidth: "5rem" }}>
                  {t(skill)}
                </span>
                <span className="flex-fill">“{t(prompt)}”</span>
                <CopyButton text={t(prompt)} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="d-flex align-items-center gap-2 mt-4">
        <Button variant="link" className="px-0 text-secondary" onClick={onDone}>
          {t("skip")}
        </Button>
        <div className="ms-auto d-flex gap-2">
          <Button variant="secondary" outline onClick={onBack}>
            {t("back")}
          </Button>
          <Button variant="primary" onClick={() => (last ? onDone() : onStep(step + 1))}>
            {last ? t("doneOpen") : t("next")}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AgentSteps;
