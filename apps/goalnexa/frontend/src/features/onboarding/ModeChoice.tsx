import { Button } from "platform-core";
import type { Mode } from "./onboardingDrafts";

/** The agent comes first and is recommended: logging progress by just saying it is what keeps goals up to date. */
const CHOICES: { mode: Mode; title: string; text: string; recommended?: boolean }[] = [
  {
    mode: "agent",
    title: "Use an AI agent",
    text: "Connect Claude, ChatGPT, Gemini, Cursor… and manage goals by chatting - “we hit 420 beta users today”.",
    recommended: true,
  },
  {
    mode: "web",
    title: "Use the website",
    text: "Set up your organization, goals and metrics here, and log progress from the dashboard.",
  },
];

export interface ModeChoiceProps {
  onChoose: (mode: Mode) => void;
  onSkip: () => void;
}

/** The wizard's first step: the website or an AI agent. */
function ModeChoice({ onChoose, onSkip }: ModeChoiceProps) {
  return (
    <div>
      <h3 className="card-title">How do you want to use GoalNexa?</h3>
      <p className="text-secondary">You can always do both - this only picks where to start.</p>
      <div className="row g-3">
        {CHOICES.map((choice) => (
          <div key={choice.mode} className="col-12 col-md-6">
            <button
              type="button"
              className={`card card-link card-link-pop h-100 w-100 text-start${choice.recommended ? " border-primary" : ""}`}
              onClick={() => onChoose(choice.mode)}
            >
              <div className="card-body">
                <h4 className="mb-1 d-flex align-items-center gap-2">
                  {choice.title}
                  {choice.recommended && <span className="badge bg-primary text-primary-fg">Recommended</span>}
                </h4>
                <div className="text-secondary">{choice.text}</div>
              </div>
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Button variant="link" className="px-0 text-secondary" onClick={onSkip}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}

export default ModeChoice;
