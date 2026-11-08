import { useT } from "platform-core";
import messages from "./messages";
import type { Audience } from "./onboardingDrafts";

const CHOICES: { audience: Audience; title: "meTitle" | "teamTitle"; text: "meText" | "teamText" }[] = [
  { audience: "me", title: "meTitle", text: "meText" },
  { audience: "team", title: "teamTitle", text: "teamText" },
];

export interface AudienceStepProps {
  audience: Audience | null;
  onChoose: (audience: Audience) => void;
}

/** The website path's first step: personal goals (no organization) or a team's (an organization). */
function AudienceStep({ audience, onChoose }: AudienceStepProps) {
  const t = useT(messages);
  return (
    <div>
      <h3 className="card-title">{t("audienceTitle")}</h3>
      <p className="text-secondary">{t("audienceHint")}</p>
      <div className="row g-3">
        {CHOICES.map((choice) => (
          <div key={choice.audience} className="col-12 col-md-6">
            <button
              type="button"
              aria-pressed={audience === choice.audience}
              className={`card card-link card-link-pop h-100 w-100 text-start${audience === choice.audience ? " border-primary" : ""}`}
              onClick={() => onChoose(choice.audience)}
            >
              <div className="card-body">
                <h4 className="mb-1">{t(choice.title)}</h4>
                <div className="text-secondary">{t(choice.text)}</div>
              </div>
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AudienceStep;
