import { Button, useT } from "platform-core";
import messages from "./messages";
import type { Mode } from "./onboardingDrafts";

/** The agent comes first and is recommended: logging progress by just saying it is what keeps goals up to date. */
const CHOICES: { mode: Mode; title: "agentTitle" | "webTitle"; text: "agentText" | "webText"; recommended?: boolean }[] = [
  { mode: "agent", title: "agentTitle", text: "agentText", recommended: true },
  { mode: "web", title: "webTitle", text: "webText" },
];

export interface ModeChoiceProps {
  onChoose: (mode: Mode) => void;
  onSkip: () => void;
}

/** The wizard's first step: the website or an AI agent. */
function ModeChoice({ onChoose, onSkip }: ModeChoiceProps) {
  const t = useT(messages);
  return (
    <div>
      <h3 className="card-title">{t("modeTitle")}</h3>
      <p className="text-secondary">{t("modeHint")}</p>
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
                  {t(choice.title)}
                  {choice.recommended && <span className="badge bg-primary text-primary-fg">{t("recommended")}</span>}
                </h4>
                <div className="text-secondary">{t(choice.text)}</div>
              </div>
            </button>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <Button variant="link" className="px-0 text-secondary" onClick={onSkip}>
          {t("skip")}
        </Button>
      </div>
    </div>
  );
}

export default ModeChoice;
