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
  return (
    <div>
      <h3 className="card-title">Ready to go</h3>
      <p className="text-secondary">
        {existingOrg ? (
          <>
            This adds {goals.length} goal{goals.length === 1 ? "" : "s"} to <strong>{existingOrg.name}</strong>.
          </>
        ) : (
          <>
            This creates <strong>{orgName.trim()}</strong> with {goals.length} goal{goals.length === 1 ? "" : "s"}.
          </>
        )}{" "}
        You can change anything later, and log progress with check-ins from the dashboard.
      </p>
      <ul className="list-unstyled mb-0">
        {goals.map((goal) => (
          <li key={goal.key} className="mb-3">
            <div className="fw-bold">
              {goal.title}
              {goal.targetDate && <span className="text-secondary fw-normal"> · by {goal.targetDate}</span>}
            </div>
            {goal.description.trim() && <div className="text-secondary">{goal.description.trim()}</div>}
            <ul className="mb-0">
              {goal.metrics.map((metric) => (
                <li key={metric.key}>
                  {metric.name}: {formatAmount(metric.base)} → {formatAmount(metric.target)}
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
