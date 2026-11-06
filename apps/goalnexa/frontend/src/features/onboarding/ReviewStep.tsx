import { formatDate, useLocale, useT } from "platform-core";
import messages from "./messages";
import { formatAmount, type GoalDraft } from "./onboardingDrafts";

export interface ReviewStepProps {
  goals: GoalDraft[];
  /** The new org's name (unused with `existingOrg`). */
  orgName: string;
  /** The org the goals go into, when it already exists. */
  existingOrg?: { id: string | null; name: string };
}

/** The website path's last step: everything that "Create" will make. */
function ReviewStep({ goals, orgName, existingOrg }: ReviewStepProps) {
  const t = useT(messages);
  const locale = useLocale();
  return (
    <div>
      <h3 className="card-title">{t("reviewTitle")}</h3>
      <p className="text-secondary">
        {existingOrg
          ? t.rich("reviewAdds", { n: goals.length, org: existingOrg.name })
          : t.rich("reviewCreates", { n: goals.length, org: orgName.trim() })}{" "}
        {t("reviewLater")}
      </p>
      <ul className="list-unstyled mb-0">
        {goals.map((goal) => (
          <li key={goal.key} className="mb-3">
            <div className="fw-bold">
              {goal.title}
              {goal.targetDate && <span className="text-secondary fw-normal"> · {t("by", { date: formatDate(`${goal.targetDate}T00:00`, undefined, locale) })}</span>}
            </div>
            {goal.description.trim() && <div className="text-secondary">{goal.description.trim()}</div>}
            <ul className="mb-0">
              {goal.metrics.map((metric) => (
                <li key={metric.key}>
                  {metric.name}: {formatAmount(metric.base, locale)} → {formatAmount(metric.target, locale)}
                  {metric.unit ? ` ${metric.unit}` : ""}
                  {metric.description.trim() && <span className="text-secondary"> - {metric.description.trim()}</span>}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ReviewStep;
