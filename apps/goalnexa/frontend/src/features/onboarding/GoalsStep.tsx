import { Button, FormControl, FormLabel, Icon, useT } from "platform-core";
import messages from "./messages";
import type { GoalDraft } from "./onboardingDrafts";

export interface GoalsStepProps {
  goals: GoalDraft[];
  /** Draft keys of goals already created (a failed create's retry) - locked. */
  locked: { has: (key: number) => boolean };
  onUpdate: (key: number, patch: Partial<GoalDraft>) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
}

/** The website path's goals: a title, an optional target date and description each. */
function GoalsStep({ goals, locked, onUpdate, onAdd, onRemove }: GoalsStepProps) {
  const t = useT(messages);
  return (
    <div>
      <h3 className="card-title">{t("goalsTitle")}</h3>
      <p className="text-secondary">{t("goalsHint")}</p>
      {goals.map((goal, i) => (
        <div key={goal.key} className="row g-2 align-items-end mb-3">
          <div className="col">
            <FormLabel htmlFor={`onboarding-goal-${goal.key}`} required={i === 0}>
              {i === 0 ? t("goal") : <span className="visually-hidden">{t("goal")}</span>}
            </FormLabel>
            <FormControl
              id={`onboarding-goal-${goal.key}`}
              autoFocus={i === 0}
              placeholder={i === 0 ? t("goalPlaceholder") : t("anotherGoal")}
              value={goal.title}
              disabled={locked.has(goal.key)}
              onChange={(event) => onUpdate(goal.key, { title: event.target.value })}
            />
          </div>
          <div className="col-4 col-md-3">
            <FormLabel htmlFor={`onboarding-goal-date-${goal.key}`}>
              {i === 0 ? t("targetDate") : <span className="visually-hidden">{t("targetDate")}</span>}
            </FormLabel>
            <FormControl
              id={`onboarding-goal-date-${goal.key}`}
              type="date"
              value={goal.targetDate}
              disabled={locked.has(goal.key)}
              onChange={(event) => onUpdate(goal.key, { targetDate: event.target.value })}
            />
          </div>
          <div className="col-auto">
            <Button
              icon
              outline
              variant="secondary"
              aria-label={t("removeGoal", { name: goal.title || i + 1 })}
              disabled={goals.length === 1 || locked.has(goal.key)}
              onClick={() => onRemove(goal.key)}
            >
              <Icon name="trash" />
            </Button>
          </div>
          <div className="col-12">
            <label className="visually-hidden" htmlFor={`onboarding-goal-desc-${goal.key}`}>{t("goalDescription")}</label>
            <FormControl
              id={`onboarding-goal-desc-${goal.key}`}
              placeholder={t("goalDescriptionPlaceholder")}
              value={goal.description}
              disabled={locked.has(goal.key)}
              onChange={(event) => onUpdate(goal.key, { description: event.target.value })}
            />
          </div>
        </div>
      ))}
      <Button variant="link" className="px-0" onClick={onAdd}>
        <Icon name="plus" /> {t("addGoal")}
      </Button>
    </div>
  );
}

export default GoalsStep;
