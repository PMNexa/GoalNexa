import { Button, FormControl, FormLabel, Icon, useT, type CrudField } from "platform-core";
import CheckInMomentField from "../../components/CheckInMomentField";
import messages from "./messages";
import type { GoalDraft } from "./onboardingDrafts";

export interface GoalsStepProps {
  goals: GoalDraft[];
  /** Draft keys of goals already created (a failed create's retry) - locked. */
  locked: { has: (key: number) => boolean };
  onUpdate: (key: number, patch: Partial<GoalDraft>) => void;
  onAdd: () => void;
  onRemove: (key: number) => void;
  /** The goal schema's frequency (`snap_to`) and moment fields; without them no frequency is asked (the server's default). */
  frequencyField?: CrudField<Record<string, unknown>>;
  momentFields?: Partial<Record<string, CrudField<Record<string, unknown>>>>;
}

/**
 * The website path's goals: a title, an optional target date and description
 * each, and how often it's checked in (its frequency - its metrics follow it,
 * and a check-in is due and reminded at each moment).
 */
function GoalsStep({ goals, locked, onUpdate, onAdd, onRemove, frequencyField, momentFields = {} }: GoalsStepProps) {
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
          {frequencyField && !locked.has(goal.key) && (
            <div className="col-12 col-md-8">
              <CheckInMomentField
                id={`onboarding-goal-freq-${goal.key}`}
                field={frequencyField}
                fields={momentFields}
                values={{ snap_to: goal.snapTo, ...goal.moment }}
                onChange={(key, value) =>
                  onUpdate(
                    goal.key,
                    key === "snap_to" ? { snapTo: String(value ?? "") } : { moment: { ...goal.moment, [key]: value } },
                  )
                }
              />
            </div>
          )}
        </div>
      ))}
      <Button variant="link" className="px-0" onClick={onAdd}>
        <Icon name="plus" /> {t("addGoal")}
      </Button>
    </div>
  );
}

export default GoalsStep;
