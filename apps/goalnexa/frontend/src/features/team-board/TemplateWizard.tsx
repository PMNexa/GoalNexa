import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Checkbox, createRequest, createSchemaFields, FormControl, FormLabel, FormSelect, loadSchema, Modal, useT, type CrudField } from "platform-core";
import type { Cycle } from "../../api/cycles";
import type { TeamOption } from "../../api/dashboard";
import { errorMessage } from "../../api/goalMembers";
import {
  applyTemplate,
  assignMembers,
  createTemplate,
  createTemplateGoal,
  createTemplateMetric,
  fetchTeamPeople,
  type GoalTemplate,
  type TeamPerson,
} from "../../api/teamBoard";
import {
  NO_CYCLE,
  newGoal,
  effectiveGoal,
  effectiveMetric,
  PER_ORDER,
  withSubGoal,
  withoutGoal,
  newMetric,
  rollupLabel,
  snapToLabel,
  stepProblem,
  targetPerLabel,
  teamTree,
  type DraftGoal,
  type Frequency,
  type DraftMetric,
} from "./templateWizardModel";
import CheckInMomentField from "../../components/CheckInMomentField";
import WizardMetricRow from "./WizardMetricRow";
import messages from "./wizardMessages";

const MOMENT_KEYS = ["snap_weekday", "snap_quarter_month", "snap_month", "snap_day", "snap_time"];

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
  const t = useT(messages);
  // Step ids (also `stepProblem`'s); their labels are `step_<id>`.
  const steps = [...(existing ? [] : ["Template" as const]), "Goals" as const, "Metrics" as const, "Teams" as const, "Review" as const];
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [goals, setGoals] = useState<DraftGoal[]>(() => [newGoal()]);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // People picked for a copy of their own: "<team id>:<user id>" (a person can be in several teams).
  const [pickedPeople, setPickedPeople] = useState<Set<string>>(new Set());
  const [people, setPeople] = useState<TeamPerson[]>([]);
  useEffect(() => {
    let live = true;
    fetchTeamPeople(accessToken).then((rows) => live && setPeople(rows));
    return () => {
      live = false;
    };
  }, [accessToken]);
  const [cycle, setCycle] = useState<string>(cycleId ?? NO_CYCLE);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // What already went through - a retry picks up from here.
  const created = useRef<{ template?: GoalTemplate; goals: Map<number, string>; metrics: Set<number>; applied: boolean; assigned?: Set<string> }>({
    goals: new Map(),
    metrics: new Set(),
    applied: false,
  });

  // The moment fields (the frequency's day and time) come from the template metric schema.
  const request = useMemo(() => createRequest(accessToken), [accessToken]);
  const [momentFields, setMomentFields] = useState<Partial<Record<string, CrudField<Record<string, unknown>>>>>({});
  useEffect(() => {
    let cancelled = false;
    loadSchema("/api/v1/template-metrics", request)
      .then((schema) => {
        if (cancelled) return;
        const fields = createSchemaFields<Record<string, unknown>>(schema).filter((f) => MOMENT_KEYS.includes(f.key));
        setMomentFields(Object.fromEntries(fields.map((f) => [f.key, f])));
      })
      // Without the schema the period is still picked; the moment stays the server's default.
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [request]);

  const name = steps[step];

  /** A goal's frequency picker: "Same as parent goal" for a sub-goal, then any time and the periods. */
  function goalFrequency(goal: DraftGoal) {
    const field: CrudField<Record<string, unknown>> = {
      key: "snap_to",
      label: t("goalFrequency"),
      type: "select",
      options: [...(goal.parent !== null ? ["parent" as Frequency] : []), ...PER_ORDER].map((per) => ({ value: per, label: snapToLabel(per) })),
    };
    const parent = goals.find((g) => g.key === goal.parent);
    const inherited = effectiveGoal(goals, parent);
    return (
      <CheckInMomentField
        id={`tw-goal-${goal.key}-snap`}
        field={field}
        fields={momentFields}
        values={{ snap_to: goal.snapTo, ...goal.moment }}
        inherited={{ snap_to: inherited.snapTo, ...inherited.moment }}
        onChange={(key, value) =>
          updateGoal(goal.key, key === "snap_to" ? { snapTo: value as Frequency } : { moment: { ...goal.moment, [key]: value } })
        }
      />
    );
  }
  const roots = goals.filter((g) => g.parent === null);
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
      // Parents come before their sub-goals in `goals`, so a sub-goal's parent is made first.
      for (const goal of goals) {
        if (!done.goals.has(goal.key)) {
          const parent = goal.parent === null ? undefined : done.goals.get(goal.parent);
          const own = goal.snapTo !== "parent" && goal.snapTo !== "goal" && goal.snapTo !== "";
          const row = await createTemplateGoal(accessToken, {
            template: template.id, title: goal.title.trim(), parent,
            // A top-level goal can't inherit: "parent" there is any time.
            snap_to: goal.parent === null && goal.snapTo === "parent" ? "" : goal.snapTo,
            ...(own ? goal.moment : {}),
          });
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
            // Which check-ins count follows the metric type: the last new value, every amount.
            one_per: "",
            snap_to: metric.snapTo === "parent" ? "goal" : metric.snapTo,
            ...(metric.snapTo && metric.snapTo !== "goal" && metric.snapTo !== "parent" ? metric.moment : {}),
          });
          done.metrics.add(metric.key);
        }
      }
      const cycleId = cycle === NO_CYCLE ? null : cycle;
      if (picked.size > 0 && !done.applied) {
        await applyTemplate(accessToken, template.id, [...picked], cycleId);
        done.applied = true;
      }
      // People's own copies, per team - with or without the team's own (P-96).
      done.assigned ??= new Set();
      const byTeam = new Map<string, string[]>();
      for (const key of pickedPeople) {
        const [team, user] = key.split(":");
        byTeam.set(team, [...(byTeam.get(team) ?? []), user]);
      }
      for (const [team, users] of byTeam) {
        if (done.assigned.has(team)) continue;
        await assignMembers(accessToken, template.id, team, users, cycleId);
        done.assigned.add(team);
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
          {t("back")}
        </Button>
      )}
      <span className="text-secondary small ms-auto">
        {t("stepOf", { n: step + 1, total: steps.length })}
      </span>
      {name === "Teams" && picked.size === 0 && pickedPeople.size === 0 ? (
        <Button variant="primary" onClick={next}>{t("skipTeams")}</Button>
      ) : last ? (
        <Button variant="primary" disabled={busy} onClick={() => void finish()}>
          {busy ? t("creating") : existing ? t("setItUp") : t("createTemplate")}
        </Button>
      ) : (
        <Button variant="primary" onClick={next}>{t("next")}</Button>
      )}
    </div>
  );

  return (
    <Modal open size="lg" title={existing ? t("setUpTitle", { title: existing.title }) : t("newTitle")} onClose={onClose} footer={footer}>
      <div className="steps steps-counter mb-4">
        {steps.map((label, i) => (
          <span key={label} className={`step-item${i === step ? " active" : ""}`}>{t(`step_${label}`)}</span>
        ))}
      </div>
      {error && <div className="alert alert-danger" role="alert">{error}</div>}

      {name === "Template" && (
        <>
          <p className="text-secondary">{t("templateIntro")}</p>
          <div className="mb-3">
            <FormLabel htmlFor="tw-title" required>{t("name")}</FormLabel>
            <FormControl id="tw-title" autoFocus value={title} placeholder={t("namePlaceholder")} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <FormLabel htmlFor="tw-description">{t("description")}</FormLabel>
            <FormControl id="tw-description" value={description} placeholder={t("descriptionPlaceholder")}
              onChange={(e) => setDescription(e.target.value)} />
          </div>
        </>
      )}

      {name === "Goals" && (
        <>
          <p className="text-secondary">{t("goalsIntro")}</p>
          {roots.map((root, ri) => {
            const subs = goals.filter((g) => g.parent === root.key);
            return (
              <div className="mb-3" key={root.key}>
                <FormLabel htmlFor={`tw-goal-${root.key}`} required>
                  {roots.length > 1 ? t("goalAria", { n: ri + 1 }) : t("mainGoal")}
                </FormLabel>
                <div className="d-flex gap-2 mb-2">
                  <FormControl id={`tw-goal-${root.key}`} autoFocus={ri === 0} value={root.title} placeholder={t("mainGoalPlaceholder")}
                    onChange={(e) => updateGoal(root.key, { title: e.target.value })} />
                  {roots.length > 1 && (
                    <Button variant="danger" outline aria-label={t("removeGoalAria", { n: ri + 1 })}
                      onClick={() => setGoals((prev) => withoutGoal(prev, root.key))}>
                      {t("remove")}
                    </Button>
                  )}
                </div>
                <div className="mb-2">{goalFrequency(root)}</div>
                {subs.length > 0 && <FormLabel className="ms-4">{t("subGoals")}</FormLabel>}
                {subs.map((goal, i) => (
                  <div className="mb-3 ms-4" key={goal.key}>
                    <div className="d-flex gap-2 mb-2">
                      <FormControl aria-label={t("subGoalAria", { n: i + 1 })} value={goal.title} placeholder={t("subGoalPlaceholder")}
                        onChange={(e) => updateGoal(goal.key, { title: e.target.value })} />
                      <Button variant="danger" outline aria-label={t("removeSubGoalAria", { n: i + 1 })}
                        onClick={() => setGoals((prev) => withoutGoal(prev, goal.key))}>
                        {t("remove")}
                      </Button>
                    </div>
                    {goalFrequency(goal)}
                  </div>
                ))}
                <Button variant="link" className="ms-4 px-0" onClick={() => setGoals((prev) => withSubGoal(prev, root.key))}>
                  {t("addSubGoal")}
                </Button>
              </div>
            );
          })}
          <Button variant="primary" outline onClick={() => setGoals((prev) => [...prev, newGoal()])}>
            {t("addGoal")}
          </Button>
        </>
      )}

      {name === "Metrics" && (
        <>
          <p className="text-secondary">{t("metricsIntro")}</p>
          {goals.map((goal) => (
            <div key={goal.key} className="mb-4">
              <h4 className="mb-2">{goal.parent === null ? goal.title : `› ${goal.title}`}</h4>
              {goal.metrics.map((metric, mi) => (
                <WizardMetricRow
                  key={metric.key}
                  goal={goal}
                  metric={metric}
                  momentFields={momentFields}
                  inherited={effectiveGoal(goals, goal)}
                  index={mi}
                  onChange={(change) => updateMetric(goal.key, metric.key, change)}
                  onRemove={() => updateGoal(goal.key, { metrics: goal.metrics.filter((m) => m.key !== metric.key) })}
                />
              ))}
              <Button variant="link" className="px-0" onClick={() => updateGoal(goal.key, { metrics: [...goal.metrics, newMetric()] })}>
                {t("addMetric")}
              </Button>
            </div>
          ))}
        </>
      )}

      {name === "Teams" && (
        <>
          <p className="text-secondary">{t("teamsIntro")}</p>
          {tree.length === 0 ? (
            <div className="alert alert-info">{t("noTeams")}</div>
          ) : (
            <>
              <div className="mb-3">
                <FormLabel htmlFor="tw-cycle">{t("cycle")}</FormLabel>
                <FormSelect id="tw-cycle" className="w-auto" value={cycle} onChange={(e) => setCycle(e.target.value)}>
                  {openCycles.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value={NO_CYCLE}>{t("noCycle")}</option>
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
                  {people.some((p) => p.team === team.id) && (
                    <div className="mt-1">
                      {people.filter((p) => p.team === team.id).map((person) => {
                        const key = `${team.id}:${person.user_id}`;
                        return (
                          <label key={key} className="form-check form-check-inline text-secondary small">
                            <Checkbox
                              checked={pickedPeople.has(key)}
                              onChange={(checked) =>
                                setPickedPeople((prev) => {
                                  const nextSet = new Set(prev);
                                  if (checked) nextSet.add(key);
                                  else nextSet.delete(key);
                                  return nextSet;
                                })
                              }
                            />
                            <span className="form-check-label">{person.name || person.email || person.user_id}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </label>
              ))}
            </>
          )}
        </>
      )}

      {name === "Review" && (
        <>
          <dl className="row mb-3">
            <dt className="col-sm-3">{t("reviewTemplate")}</dt>
            <dd className="col-sm-9">{existing ? existing.title : title}</dd>
            <dt className="col-sm-3">{t("reviewTeams")}</dt>
            <dd className="col-sm-9">
              {picked.size === 0
                ? t("noneYet")
                : `${tree.filter(({ team }) => picked.has(team.id)).map(({ team }) => team.name).join(", ")}${
                    cycle === NO_CYCLE ? "" : ` · ${cycles.find((c) => c.id === cycle)?.name ?? ""}`
                  }`}
            </dd>
            {pickedPeople.size > 0 && (
              <>
                <dt className="col-sm-3">{t("reviewPeople")}</dt>
                <dd className="col-sm-9">
                  {people
                    .filter((p) => pickedPeople.has(`${p.team}:${p.user_id}`))
                    .map((p) => `${p.name || p.email || p.user_id} (${teams.find((team) => team.id === p.team)?.name ?? ""})`)
                    .join(", ")}
                </dd>
              </>
            )}
          </dl>
          {goals.map((goal) => (
            <div key={goal.key} className="mb-2">
              <strong>{goal.parent === null ? goal.title : `› ${goal.title}`}</strong>
              <ul className="mb-0">
                {goal.metrics.map((m) => (
                  <li key={m.key}>
                    {t("reviewMetric", {
                      name: m.name,
                      unit: m.unit,
                      base: m.base,
                      target: m.target.trim() ? m.target : "",
                      per: m.targetPer ? targetPerLabel(m.targetPer).toLowerCase() : "",
                      weekdays: m.countDays === "weekdays",
                      hitRate: m.progressBy === "hit_rate",
                      snap: (() => {
                        const per = effectiveMetric(goals, goal, m).snapTo;
                        return per ? snapToLabel(per).toLowerCase() : "";
                      })(),
                      sum: m.aggregation === "sum",
                      rollup: rollupLabel(m.rollup).toLowerCase(),
                    })}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <p className="text-secondary small mt-3 mb-0">{t("changeLater")}</p>
        </>
      )}
    </Modal>
  );
}

export default TemplateWizard;
