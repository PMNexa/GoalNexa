import { useRef, useState } from "react";
import { Button, Checkbox, FormControl, FormLabel, FormSelect, Modal } from "platform-core";
import type { Cycle } from "../../api/cycles";
import type { TeamOption } from "../../api/dashboard";
import { errorMessage } from "../../api/goalMembers";
import {
  applyTemplate,
  createTemplate,
  createTemplateGoal,
  createTemplateMetric,
  type GoalTemplate,
} from "../../api/teamBoard";
import {
  NO_CYCLE,
  ONE_PER_LABELS,
  ROLLUP_LABELS,
  SNAP_TO_LABELS,
  TARGET_PER_LABELS,
  newGoal,
  newMetric,
  stepProblem,
  teamTree,
  type DraftGoal,
  type DraftMetric,
} from "./templateWizardModel";
import WizardMetricRow from "./WizardMetricRow";

export interface TemplateWizardProps {
  accessToken: string;
  orgId: string;
  /** Set up this (empty) template instead of creating a new one - skips the first step. */
  existing?: GoalTemplate | null;
  teams: TeamOption[];
  cycles: Cycle[];
  /** The cycle to add it to teams in, preselected. `null` = none. */
  cycleId: string | null;
  /** Fires once everything is created; the template's id. */
  onDone: (templateId: string, created: GoalTemplate | null) => void;
  onClose: () => void;
}


/**
 * Sets up a goal template in one go, in a modal (the team board's "+ New",
 * and an empty template's "Set it up"): its name -> the goal and any
 * sub-goals -> each goal's metrics (how check-ins count, how teams add up,
 * the default start and target) -> which teams get it, in which cycle ->
 * review. Nothing is written before the last step; then it creates
 * everything over the REST API, and a failed step retries without
 * duplicating what went through.
 */
function TemplateWizard({ accessToken, orgId, existing, teams, cycles, cycleId, onDone, onClose }: TemplateWizardProps) {
  const steps = [...(existing ? [] : ["Template"]), "Goals", "Metrics", "Teams", "Review"];
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState<DraftGoal[]>(() => [newGoal()]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [cycle, setCycle] = useState<string>(cycleId ?? NO_CYCLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What already went through - a retry picks up from here.
  const created = useRef<{ template?: GoalTemplate; goals: Map<number, string>; metrics: Set<number>; applied: boolean }>({
    goals: new Map(),
    metrics: new Set(),
    applied: false,
  });

  const name = steps[step];
  const tree = teamTree(teams);
  const openCycles = cycles.filter((c) => c.status !== "closed");

  function updateGoal(key: number, change: Partial<DraftGoal>) {
    setGoals((prev) => prev.map((g) => (g.key === key ? { ...g, ...change } : g)));
  }

  function updateMetric(goalKey: number, metricKey: number, change: Partial<DraftMetric>) {
    setGoals((prev) =>
      prev.map((g) =>
        g.key === goalKey ? { ...g, metrics: g.metrics.map((m) => (m.key === metricKey ? { ...m, ...change } : m)) } : g,
      ),
    );
  }

  /** Why the current step can't go on yet, or null. */
  function problem(): string | null {
    return stepProblem(name, title, goals);
  }

  function next() {
    const why = problem();
    if (why) return setError(why);
    setError(null);
    setStep((s) => s + 1);
  }

  async function finish() {
    setBusy(true);
    setError(null);
    const done = created.current;
    try {
      const template =
        existing ??
        (done.template ??= await createTemplate(accessToken, { org_id: orgId, title: title.trim(), description: description.trim() }));
      const [main, ...subs] = goals;
      for (const goal of [main, ...subs]) {
        if (!done.goals.has(goal.key)) {
          const parent = goal === main ? undefined : done.goals.get(main.key);
          const row = await createTemplateGoal(accessToken, { template: template.id, title: goal.title.trim(), parent });
          done.goals.set(goal.key, row.id);
        }
        for (const metric of goal.metrics) {
          if (done.metrics.has(metric.key)) continue;
          await createTemplateMetric(accessToken, {
            template_goal: done.goals.get(goal.key)!,
            name: metric.name.trim(),
            unit: metric.unit.trim(),
            aggregation: metric.aggregation,
            rollup: metric.rollup,
            default_base: metric.base.trim(),
            ...(metric.target.trim() !== "" ? { default_target: metric.target.trim() } : {}),
            target_per: metric.targetPer,
            count_days: metric.countDays,
            progress_by: metric.targetPer ? metric.progressBy : "total",
            one_per: metric.onePer,
            snap_to: metric.snapTo,
          });
          done.metrics.add(metric.key);
        }
      }
      if (picked.size > 0 && !done.applied) {
        await applyTemplate(accessToken, template.id, [...picked], cycle === NO_CYCLE ? null : cycle);
        done.applied = true;
      }
      onDone(template.id, existing ? null : template);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const last = step === steps.length - 1;
  const footer = (
    <div className="d-flex w-100 align-items-center gap-2">
      {step > 0 && (
        <Button variant="secondary" outline disabled={busy} onClick={() => { setError(null); setStep(step - 1); }}>
          Back
        </Button>
      )}
      <span className="text-secondary small ms-auto">
        Step {step + 1} of {steps.length}
      </span>
      {name === "Teams" && picked.size === 0 ? (
        <Button variant="primary" onClick={next}>Skip - add to teams later</Button>
      ) : last ? (
        <Button variant="primary" disabled={busy} onClick={() => void finish()}>
          {busy ? "Creating…" : existing ? "Set it up" : "Create the template"}
        </Button>
      ) : (
        <Button variant="primary" onClick={next}>Next</Button>
      )}
    </div>
  );

  return (
    <Modal open size="lg" title={existing ? `Set up "${existing.title}"` : "New goal template"} onClose={onClose} footer={footer}>
      <div className="steps steps-counter mb-4">
        {steps.map((label, i) => (
          <span key={label} className={`step-item${i === step ? " active" : ""}`}>{label}</span>
        ))}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {name === "Template" && (
        <>
          <p className="text-secondary">
            One goal system several teams run: the same goals and metrics, each team with its own targets and check-ins,
            and totals for every department and the whole organization.
          </p>
          <div className="mb-3">
            <FormLabel htmlFor="tw-title" required>Name</FormLabel>
            <FormControl id="tw-title" autoFocus value={title} placeholder="Sales targets" onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <FormLabel htmlFor="tw-description">Description</FormLabel>
            <FormControl id="tw-description" value={description} placeholder="Optional - what it's for"
              onChange={(e) => setDescription(e.target.value)} />
          </div>
        </>
      )}

      {name === "Goals" && (
        <>
          <p className="text-secondary">
            What every team works toward, as an outcome. Break it down into sub-goals if it helps - each gets its own
            metrics next.
          </p>
          <div className="mb-3">
            <FormLabel htmlFor="tw-goal-main" required>Main goal</FormLabel>
            <FormControl id="tw-goal-main" autoFocus value={goals[0].title} placeholder="Grow revenue"
              onChange={(e) => updateGoal(goals[0].key, { title: e.target.value })} />
          </div>
          {goals.length > 1 && <FormLabel className="ms-4">Sub-goals</FormLabel>}
          {goals.slice(1).map((goal, i) => (
            <div className="d-flex gap-2 mb-2 ms-4" key={goal.key}>
              <FormControl aria-label={`Sub-goal ${i + 1}`} value={goal.title} placeholder="Hire the team"
                onChange={(e) => updateGoal(goal.key, { title: e.target.value })} />
              <Button variant="danger" outline aria-label={`Remove sub-goal ${i + 1}`}
                onClick={() => setGoals((prev) => prev.filter((g) => g.key !== goal.key))}>
                Remove
              </Button>
            </div>
          ))}
          <Button variant="link" className="ms-4 px-0" onClick={() => setGoals((prev) => [...prev, newGoal()])}>
            + Add a sub-goal
          </Button>
        </>
      )}

      {name === "Metrics" && (
        <>
          <p className="text-secondary">
            The numbers every team tracks. Leave the target empty to let each team set its own (until then it doesn't
            count toward the totals).
          </p>
          {goals.map((goal, gi) => (
            <div key={goal.key} className="mb-4">
              <h4 className="mb-2">{gi === 0 ? goal.title : `› ${goal.title}`}</h4>
              {goal.metrics.map((metric, mi) => (
                <WizardMetricRow
                  key={metric.key}
                  goal={goal}
                  metric={metric}
                  index={mi}
                  onChange={(change) => updateMetric(goal.key, metric.key, change)}
                  onRemove={() => updateGoal(goal.key, { metrics: goal.metrics.filter((m) => m.key !== metric.key) })}
                />
              ))}
              <Button variant="link" className="px-0" onClick={() => updateGoal(goal.key, { metrics: [...goal.metrics, newMetric()] })}>
                + Add a metric
              </Button>
            </div>
          ))}
        </>
      )}

      {name === "Teams" && (
        <>
          <p className="text-secondary">
            Which teams run it? Each gets its own copy to set targets and check in on. A department can have its own
            copy too, next to its teams'.
          </p>
          {tree.length === 0 ? (
            <div className="alert alert-info">
              This organization has no teams yet - create them under Organizations → Teams, then add the template to
              them from the team board (Targets).
            </div>
          ) : (
            <>
              <div className="mb-3">
                <FormLabel htmlFor="tw-cycle">Cycle</FormLabel>
                <FormSelect id="tw-cycle" className="w-auto" value={cycle} onChange={(e) => setCycle(e.target.value)}>
                  {openCycles.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value={NO_CYCLE}>No cycle</option>
                </FormSelect>
              </div>
              {tree.map(({ team, depth }) => (
                <label key={team.id} className="form-check" style={{ marginLeft: `${depth * 1.25}rem` }}>
                  <Checkbox
                    checked={picked.has(team.id)}
                    onChange={(checked) =>
                      setPicked((prev) => {
                        const nextSet = new Set(prev);
                        if (checked) nextSet.add(team.id);
                        else nextSet.delete(team.id);
                        return nextSet;
                      })
                    }
                  />
                  <span className="form-check-label">{team.name}</span>
                </label>
              ))}
            </>
          )}
        </>
      )}

      {name === "Review" && (
        <>
          <dl className="row mb-3">
            <dt className="col-sm-3">Template</dt>
            <dd className="col-sm-9">{existing ? existing.title : title}</dd>
            <dt className="col-sm-3">Teams</dt>
            <dd className="col-sm-9">
              {picked.size === 0
                ? "None yet - add it to teams later from the board."
                : `${tree.filter(({ team }) => picked.has(team.id)).map(({ team }) => team.name).join(", ")}${
                    cycle === NO_CYCLE ? "" : ` · ${cycles.find((c) => c.id === cycle)?.name ?? ""}`
                  }`}
            </dd>
          </dl>
          {goals.map((goal, gi) => (
            <div key={goal.key} className="mb-2">
              <strong>{gi === 0 ? goal.title : `› ${goal.title}`}</strong>
              <ul className="mb-0">
                {goal.metrics.map((m) => (
                  <li key={m.key}>
                    {m.name}
                    {m.unit && ` (${m.unit})`}: from {m.base}
                    {m.target.trim() ? ` to ${m.target}` : ", each team sets its target"}
                    {m.targetPer ? ` ${TARGET_PER_LABELS[m.targetPer].toLowerCase()}${m.countDays === "weekdays" ? " (weekdays)" : ""}${m.progressBy === "hit_rate" ? ", counted by how often it's hit" : ""}` : ""}
                    {m.onePer ? ` · ${ONE_PER_LABELS[m.onePer].toLowerCase()} counts` : ""}
                    {m.snapTo ? ` · check-ins are for ${SNAP_TO_LABELS[m.snapTo].toLowerCase()}` : ""} ·{" "}
                    {m.aggregation === "sum" ? "amounts add up" : "readings"} · totals: {ROLLUP_LABELS[m.rollup].toLowerCase()}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-secondary small mt-3 mb-0">You can change any of it later on the template's page.</p>
        </>
      )}
    </Modal>
  );
}

export default TemplateWizard;
