import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, FormLabel } from "platform-core";
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
} from "../lib/api/cycles";
import { errorMessage } from "../lib/api/goalMembers";
import type { Goal } from "../lib/api/goals";

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

const OUTCOME_LABELS: Record<GoalOutcome, string> = {
  achieved: "Achieved",
  partial: "Partial",
  missed: "Missed",
  dropped: "Dropped",
};
const OUTCOME_BADGES: Record<GoalOutcome, string> = {
  achieved: "bg-success-lt",
  partial: "bg-warning-lt",
  missed: "bg-danger-lt",
  dropped: "bg-secondary-lt",
};
const HEALTH_LABELS: Record<string, string> = {
  on_track: "On track",
  at_risk: "At risk",
  off_track: "Off track",
  achieved: "Achieved",
  unknown: "—",
};

function pct(value: string | null): string {
  return value === null ? "—" : `${Math.round(Number(value))}%`;
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

/** The cycle after `cycle`: same length, starting the next day, named "Q2 2027" after "Q1 2027". */
function nextCycleDraft(cycle: Cycle) {
  const length = (Date.parse(cycle.ends_on) - Date.parse(cycle.starts_on)) / 86400000;
  const starts_on = addDays(cycle.ends_on, 1);
  const quarter = /^Q([1-4])\s+(\d{4})$/.exec(cycle.name.trim());
  const name = quarter
    ? quarter[1] === "4"
      ? `Q1 ${Number(quarter[2]) + 1}`
      : `Q${Number(quarter[1]) + 1} ${quarter[2]}`
    : `${cycle.name} (next)`;
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
      const created = await createCycle(accessToken, nextCycleDraft(cycle));
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
        <CardBody>{error ? <div className="text-danger">{error}</div> : <div className="text-secondary">Loading…</div>}</CardBody>
      </Card>
    );
  }

  if (cycle.status === "closed") {
    const average = scores.length ? scores.reduce((sum, s) => sum + Number(s.score), 0) / scores.length : null;
    const counts = (Object.keys(OUTCOME_LABELS) as GoalOutcome[]).map((o) => [o, scores.filter((s) => s.outcome === o).length] as const);
    return (
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Scorecard</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="d-flex flex-wrap gap-3 align-items-baseline">
            <div>
              <div className="text-secondary small">Average score</div>
              <div className="h2 mb-0">{average === null ? "—" : average.toFixed(2)}</div>
            </div>
            {counts.map(([outcome, count]) => (
              <div key={outcome}>
                <div className="text-secondary small">{OUTCOME_LABELS[outcome]}</div>
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
                  <th>Goal</th>
                  <th>Score</th>
                  <th>Outcome</th>
                  <th>Final progress</th>
                  <th>Reflection</th>
                </tr>
              </thead>
              <tbody>
                {scores.map((s) => (
                  <tr key={s.id}>
                    <td>
                      {scoredGoals.get(s.goal)?.title ?? "(deleted goal)"}
                      {s.rolled_to && <span className="badge bg-azure-lt ms-2">Rolled over</span>}
                    </td>
                    <td className="fw-bold">{Number(s.score).toFixed(2)}</td>
                    <td>
                      <span className={`badge ${OUTCOME_BADGES[s.outcome]}`}>{OUTCOME_LABELS[s.outcome]}</span>
                    </td>
                    <td>{pct(s.final_progress)}</td>
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
        <CardTitle>Close this cycle</CardTitle>
      </CardHeader>
      <CardBody>
        <p className="text-secondary mb-0">
          Score each goal from 0 to 1 (0.7 counts as achieved for an ambitious goal), then mark it done, roll it over into
          the next cycle (a copy with its metrics - readings continue from where they are, amounts start over) or drop it.
          Closing can't be undone.
        </p>
      </CardBody>
      {goals.length === 0 ? (
        <CardBody className="border-top text-secondary">No goals in this cycle - closing just ends it.</CardBody>
      ) : (
        <div className="table-responsive">
          <table className="table table-vcenter card-table">
            <thead>
              <tr>
                <th>Goal</th>
                <th>Progress</th>
                <th style={{ width: "7rem" }}>Score</th>
                <th style={{ width: "9rem" }}>Then</th>
                <th>Reflection</th>
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
                      {pct(goal.progress)} <span className="text-secondary small">{HEALTH_LABELS[goal.health] ?? ""}</span>
                    </td>
                    <td>
                      <input
                        type="number"
                        className="form-control form-control-sm"
                        min={0}
                        max={1}
                        step={0.05}
                        aria-label={`Score for ${goal.title}`}
                        value={d.score}
                        onChange={(event) => setDecision(goal.id, { score: event.target.value })}
                      />
                    </td>
                    <td>
                      <select
                        className="form-select form-select-sm"
                        aria-label={`What happens to ${goal.title}`}
                        value={d.action}
                        onChange={(event) => setDecision(goal.id, { action: event.target.value as CloseAction })}
                      >
                        <option value="done">Done</option>
                        <option value="rollover">Roll over</option>
                        <option value="drop">Drop</option>
                      </select>
                    </td>
                    <td>
                      <input
                        className="form-control form-control-sm"
                        placeholder="What we learned…"
                        aria-label={`Reflection on ${goal.title}`}
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
              Roll over into
            </FormLabel>
            <div className="d-flex gap-2">
              <select
                id="cycle-next"
                className="form-select"
                value={nextCycle}
                onChange={(event) => setNextCycle(event.target.value)}
              >
                <option value="">Pick a cycle…</option>
                {others.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.starts_on} – {c.ends_on})
                  </option>
                ))}
              </select>
              <Button variant="secondary" outline disabled={busy} onClick={handleCreateNext}>
                Create “{nextCycleDraft(cycle).name}”
              </Button>
            </div>
          </div>
        )}
        <FormLabel htmlFor="cycle-retro">Retro</FormLabel>
        <textarea
          id="cycle-retro"
          className="form-control"
          rows={3}
          placeholder="What went well, what didn't, what we'll change…"
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
          Close cycle{goals.length ? ` and score ${goals.length} goal${goals.length === 1 ? "" : "s"}` : ""}
        </Button>
      </CardBody>
    </Card>
  );
}

export default CyclePanel;
