import { Button, CopyButton, FormControl } from "platform-core";
import { McpConnectGuide } from "platform-mcp-frontend";
import { AGENT_STEPS } from "./onboardingDrafts";

/** What to say to the agent first - each maps to one of goalnexa's skills. */
const STARTER_PROMPTS = [
  {
    skill: "Plan",
    prompt: "Set up GoalNexa for my team Acme: we want to grow monthly revenue from $40k to $60k by December 31.",
  },
  { skill: "Check in", prompt: "We're at $45k monthly revenue now." },
  { skill: "Review", prompt: "How are my goals doing? Anything at risk?" },
];

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
  const last = step === AGENT_STEPS.length - 1;
  return (
    <div>
      {step === 0 && (
        <div>
          <h3 className="card-title">Connect your AI assistant</h3>
          <p className="text-secondary">
            Pick the app you use. It gets exactly your access in GoalNexa - nothing more - and you can disconnect it any
            time from “MCP access”.
          </p>
          <McpConnectGuide accessToken={accessToken} tokenName="Onboarding" />
        </div>
      )}

      {step === 1 && (
        <div>
          <h3 className="card-title">Teach it GoalNexa</h3>
          <p className="text-secondary">
            Skills are ready-made playbooks - planning goals, checking in, weekly reviews. Paste this into Claude Code,
            Codex or any agent that supports skills. (A Claude connector works without them; skip this step then.)
          </p>
          <div className="d-flex gap-2">
            <FormControl readOnly value={skillsPrompt} aria-label="Skills install prompt" onFocus={(event) => event.target.select()} />
            <CopyButton text={skillsPrompt} />
          </div>
          <small className="form-hint">
            <a href={skillsUrl} target="_blank" rel="noreferrer">
              See what gets installed
            </a>
          </small>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3 className="card-title">Tell it what you're working toward</h3>
          <p className="text-secondary">
            Start with a plan - your agent creates the organization, goals and metrics, and asks before saving. Then keep it
            updated in plain words.
          </p>
          <ul className="list-unstyled mb-0">
            {STARTER_PROMPTS.map(({ skill, prompt }) => (
              <li key={skill} className="d-flex align-items-center gap-2 mb-2">
                <span className="badge bg-secondary-lt" style={{ minWidth: "5rem" }}>
                  {skill}
                </span>
                <span className="flex-fill">“{prompt}”</span>
                <CopyButton text={prompt} />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="d-flex align-items-center gap-2 mt-4">
        <Button variant="link" className="px-0 text-secondary" onClick={onDone}>
          Skip for now
        </Button>
        <div className="ms-auto d-flex gap-2">
          <Button variant="secondary" outline onClick={onBack}>
            Back
          </Button>
          <Button variant="primary" onClick={() => (last ? onDone() : onStep(step + 1))}>
            {last ? "Done - open dashboard" : "Next"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default AgentSteps;
