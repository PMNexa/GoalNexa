import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, formatDate, formatNumber, FormLabel, useLocale, useT, type Locale } from "platform-core";
import {
  closeCycle,
  createCycle,
  fetchCycle,
  fetchCycleGoals,
  fetchCycles,
  fetchCycleScores,
  fetchGoalsById,
  type CloseAction,
  type Cycle,
  type GoalOutcome,
  type GoalScore,
} from "../../api/cycles";
import { errorMessage } from "../../api/goalMembers";
import type { Goal } from "../../api/goals";
import messages from "./CyclePanel.messages";

export interface CyclePanelProps {
  accessToken: string;
  cycleId: string;
  /** Fires once the cycle is closed - e.g. to reload a detail view showing its status. */
  onClosed?: () => void;
}

interface Decision {
  action: CloseAction;
  score: string;
  reflection: string;
}

const OUTCOMES: GoalOutcome[] = ["achieved", "partial", "missed", "dropped"];
const OUTCOME_BADGES: Record<GoalOutcome, string> = {
  achieved: "bg-success-lt",
  partial: "bg-warning-lt",
  missed: "bg-danger-lt",
  dropped: "bg-secondary-lt",
};
const HEALTH_KEYS: Record<string, "on_track" | "at_risk" | "off_track" | "achieved"> = {
  on_track: "on_track",
  at_risk: "at_risk",
  off_track: "off_track",
  achieved: "achieved",
};

function pct(value: string | null, locale: Locale): string {
  return value === null ? "—" : formatNumber(Math.round(Number(value)) / 100, { style: "percent" }, locale);
}

function score(value: number, locale: Locale): string {
  return formatNumber(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 }, locale);
}

/** The default score: progress / 100, capped at 1 - same as the backend's `default_score`. */
function defaultScore(goal: Goal): string {
  const progress = goal.progress === null ? 0 : Number(goal.progress);
  return (Math.min(1, Math.max(0, progress / 100))).toFixed(2);
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** The cycle after `cycle`: same length, starting the next day, named "Q2 2027" after "Q1 2027" (else `nextName(name)`). */
function nextCycleDraft(cycle: Cycle, nextName: (name: string) => string) {
  const length = (Date.parse(cycle.ends_on) - Date.parse(cycle.starts_on)) / 86400000;
  const starts_on = addDays(cycle.ends_on, 1);
  const quarter = /^Q([1-4])\s+(\d{4})$/.exec(cycle.name.trim());
  const name = quarter
    ? quarter[1] === "4"
      ? `Q1 ${Number(quarter[2]) + 1}`
      : `Q${Number(quarter[1]) + 1} ${quarter[2]}`
    : nextName(cycle.name);
  return { name, org_id: cycle.org_id, starts_on, ends_on: addDays(starts_on, length), status: "planning" as const };
}

/**
 * A cycle's end: while it's open, the close form - one row per goal in it
 * (score 0-1, prefilled from its progress; done / roll over into the next
 * cycle / drop; a one-line reflection), the cycle to roll into (or "Create
 * the next one"), and the team's retro. Once closed, its scorecard. The
 * backend does the closing in one go (`goalnexa/cycles.py`).
 */
function CyclePanel({ accessToken, cycleId, onClosed }: CyclePanelProps) {
  const t = useT(messages);
  const locale = useLocale();
  const nextName = (name: string) => t("nextName", { name });
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [scores, setScores] = useState<GoalScore[]>([]);
  const [scoredGoals, setScoredGoals] = useState<Map<string, Goal>>(new Map());
  const [others, setOthers] = useState<Cycle[]>([]);
  const [decisions, setDecisions] = useState<Map<string, Decision>>(new Map());
  const [nextCycle, setNextCycle] = useState("");
  const [retro, setRetro] = useState("");
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const row = await fetchCycle(accessToken, cycleId);
      if (row.status === "closed") {
        const cycleScores = await fetchCycleScores(accessToken, cycleId);
        const scored = await fetchGoalsById(accessToken, cycleScores.map((s) => s.goal));
        return { row, cycleGoals: [], cycleScores, scored, siblings: [] };
      }
      const [cycleGoals, siblings] = await Promise.all([
        fetchCycleGoals(accessToken, cycleId),
        fetchCycles(accessToken, row.org_id),
      ]);
      return { row, cycleGoals, cycleScores: [], scored: [], siblings };
    })()
      .then(({ row, cycleGoals, cycleScores, scored, siblings }) => {
        if (cancelled) return;
        setCycle(row);
        setRetro(row.retro);
        setGoals(cycleGoals);
        setScores(cycleScores);
        setScoredGoals(new Map(scored.map((g) => [g.id, g])));
        const open = siblings.filter((c) => c.id !== cycleId && c.status !== "closed");
        setOthers(open);
        setNextCycle((prev) => prev || (open.find((c) => c.starts_on > row.starts_on)?.id ?? ""));
        setDecisions(new Map(cycleGoals.map((g) => [g.id, { action: "done", score: defaultScore(g), reflection: "" }])));
      })
      .catch((thrown: unknown) => !cancelled && setError(errorMessage(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, cycleId, version]);

  function setDecision(goalId: string, patch: Partial<Decision>) {
    setDecisions((prev) => new Map(prev).set(goalId, { ...(prev.get(goalId) as Decision), ...patch }));
  }

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  function handleCreateNext() {
    if (!cycle) return;
    void run(async () => {
      const created = await createCycle(accessToken, nextCycleDraft(cycle, nextName));
      setOthers((prev) => [...prev, created]);
      setNextCycle(created.id);
    });
  }

  function handleClose() {
    void run(async () => {
      await closeCycle(accessToken, cycleId, {
        decisions: goals.map((goal) => {
          const d = decisions.get(goal.id) as Decision;
          return { goal: goal.id, action: d.action, score: Number(d.score), reflection: d.reflection };
        }),
        next_cycle: nextCycle || null,
        retro,
      });
      setVersion((v) => v + 1);
      onClosed?.();
    });
  }

  const rollsOver = [...decisions.values()].some((d) => d.action === "rollover");
  const badScore = [...decisions.values()].some((d) => d.score === "" || !(Number(d.score) >= 0 && Number(d.score) <= 1));

  if (cycle === null) {
    return (
      <Card className="mt-3">
        <CardBody>{error ? <div className="text-danger">{error}</div> : <div className="text-secondary">{t("loading")}</div>}</CardBody>
      </Card>
    );
  }

  if (cycle.status === "closed") {
    const average = scores.length ? scores.reduce((sum, s) => sum + Number(s.score), 0) / scores.length : null;
    const counts = OUTCOMES.map((o) => [o, scores.filter((s) => s.outcome === o).length] as const);
    return (
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>{t("scorecard")}</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="d-flex flex-wrap gap-3 align-items-baseline">
            <div>
              <div className="text-secondary small">{t("averageScore")}</div>
              <div className="h2 mb-0">{average === null ? "—" : score(average, locale)}</div>
            </div>
            {counts.map(([outcome, count]) => (
              <div key={outcome}>
                <div className="text-secondary small">{t(outcome)}</div>
                <div className="h3 mb-0">{count}</div>
              </div>
            ))}
          </div>
        </CardBody>
        {scores.length > 0 && (
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <thead>
                <tr>
                  <th>{t("goal")}</th>
                  <th>{t("score")}</th>
                  <th>{t("outcome")}</th>
                  <th>{t("finalProgress")}</th>
                  <th>{t("reflection")}</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {scoredGoals.get(s.goal)?.title ?? t("deletedGoal")}
                      {s.rolled_to && <span className="badge bg-azure-lt ms-2">{t("rolledOver")}</span>}
                    </td>
                    <td className="fw-bold">{score(Number(s.score), locale)}</td>
                    <td>
                      <span className={`badge ${OUTCOME_BADGES[s.outcome]}`}>{t(s.outcome)}</span>
                    </td>
                    <td>{pct(s.final_progress, locale)}</td>
                    <td className="text-secondary">{s.reflection || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    );
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>{t("closeTitle")}</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-secondary mb-0">
          {t("closeIntro")}
        </p>
      </CardBody>
      {goals.length === 0 ? (
        <CardBody className="border-top text-secondary">{t("noGoals")}</CardBody>
      ) : (
        <div className="table-responsive">
          <table className="table table-vcenter card-table">
            <thead>
              <tr>
                <th>{t("goal")}</th>
                <th>{t("progress")}</th>
                <th style={{ width: "7rem" }}>{t("score")}</th>
                <th style={{ width: "9rem" }}>{t("then")}</th>
                <th>{t("reflection")}</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((goal) => {
                const d = decisions.get(goal.id);
                if (!d) return null;
                return (
                  <tr key={goal.id}>
                    <td>{goal.title}</td>
                    <td className="text-nowrap">
                      {pct(goal.progress, locale)}{" "}
                      <span className="text-secondary small">{HEALTH_KEYS[goal.health] ? t(HEALTH_KEYS[goal.health]) : goal.health === "unknown" ? "—" : ""}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        max={1}
                        step={0.05}
                        aria-label={t("scoreFor", { title: goal.title })}
                        value={d.score}
                        onChange={(event) => setDecision(goal.id, { score: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        aria-label={t("whatHappens", { title: goal.title })}
                        value={d.action}
                        onChange={(event) => setDecision(goal.id, { action: event.target.value as CloseAction })}
                      >
                        <option value="done">{t("done")}</option>
                        <option value="rollover">{t("rollover")}</option>
                        <option value="drop">{t("drop")}</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        placeholder={t("reflectionPlaceholder")}
                        aria-label={t("reflectionOn", { title: goal.title })}
                        value={d.reflection}
                        onChange={(event) => setDecision(goal.id, { reflection: event.target.value })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <CardBody className="border-top">
        {rollsOver && (
          <div className="mb-3">
            <FormLabel htmlFor="cycle-next" required>
              {t("rollInto")}
            </FormLabel>
            <div className="d-flex gap-2">
              <select
                id="cycle-next"
                className="form-select"
                value={nextCycle}
                onChange={(event) => setNextCycle(event.target.value)}
              >
                <option value="">{t("pickCycle")}</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {t("cycleOption", { name: c.name, start: formatDate(`${c.starts_on}T00:00`, undefined, locale), end: formatDate(`${c.ends_on}T00:00`, undefined, locale) })}
                  </option>
                ))}
              </select>
              <Button variant="secondary" outline disabled={busy} onClick={handleCreateNext}>
                {t("createNext", { name: nextCycleDraft(cycle, nextName).name })}
              </Button>
            </div>
          </div>
        )}
        <FormLabel htmlFor="cycle-retro">{t("retro")}</FormLabel>
        <textarea
          id="cycle-retro"
          className="form-control"
          rows={3}
          placeholder={t("retroPlaceholder")}
          value={retro}
          onChange={(event) => setRetro(event.target.value)}
        />
        {error && (
          <div className="alert alert-danger mt-3 mb-0" role="alert">
            {error}
          </div>
        )}
      </CardBody>
      <CardBody className="border-top">
        <Button variant="primary" disabled={busy || badScore || (rollsOver && !nextCycle)} onClick={handleClose}>
          {t("close", { n: goals.length })}
        </Button>
      </CardBody>
    </Card>
  );
}

export default CyclePanel;
