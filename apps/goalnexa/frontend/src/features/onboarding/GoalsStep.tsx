import { Button, FormControl, FormLabel, Icon } from "platform-core";
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
  return (
    <div>
      <h3 className="card-title">What are you aiming for?</h3>
      <p className="text-secondary">Add a few goals. A target date is optional, but it lets the dashboard project whether you'll make it.</p>
      {goals.map((goal, i) => (
        <div key={goal.key} className="row g-2 align-items-end mb-3">
          <div className="col">
            <FormLabel htmlFor={`onboarding-goal-${goal.key}`} required={i === 0}>
              {i === 0 ? "Goal" : <span className="visually-hidden">Goal</span>}
            </FormLabel>
            <FormControl
              id={`onboarding-goal-${goal.key}`}
              autoFocus={i === 0}
              placeholder={i === 0 ? "e.g. Grow monthly revenue" : "Another goal"}
              value={goal.title}
              disabled={locked.has(goal.key)}
              onChange={(event) => onUpdate(goal.key, { title: event.target.value })}
            />
          </div>
          <div className="col-4 col-md-3">
            <FormLabel htmlFor={`onboarding-goal-date-${goal.key}`}>
              {i === 0 ? "Target date" : <span className="visually-hidden">Target date</span>}
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
              aria-label={`Remove goal ${goal.title || i + 1}`}
              disabled={goals.length === 1 || locked.has(goal.key)}
              onClick={() => onRemove(goal.key)}
            >
              <Icon name="trash" />
            </Button>
          </div>
          <div className="col-12">
            <label className="visually-hidden" htmlFor={`onboarding-goal-desc-${goal.key}`}>Goal description</label>
            <FormControl
              id={`onboarding-goal-desc-${goal.key}`}
              placeholder="Description (optional) - why it matters, what done looks like"
              value={goal.description}
              disabled={locked.has(goal.key)}
              onChange={(event) => onUpdate(goal.key, { description: event.target.value })}
            />
          </div>
        </div>
      ))}
      <Button variant="link" className="px-0" onClick={onAdd}>
        <Icon name="plus" /> Add goal
      </Button>
    </div>
  );
}

export default GoalsStep;
