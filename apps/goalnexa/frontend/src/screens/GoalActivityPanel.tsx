import { useEffect, useState, type SubmitEvent } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle } from "platform-core";
import { errorMessage, fetchGoal, fetchOrgPeople, type OrgPerson } from "../lib/api/goalMembers";
import { addComment, deleteComment, fetchActivities, fetchComments, type Activity, type GoalComment } from "../lib/api/feed";
import type { Goal } from "../lib/api/goals";

export interface GoalActivityPanelProps {
  accessToken: string;
  goalId: string;
}

interface Loaded {
  goal: Goal;
  activities: Activity[];
  comments: GoalComment[];
  people: Map<string, OrgPerson>;
  me: string | null;
}

type Entry = { kind: "activity"; at: number; item: Activity } | { kind: "comment"; at: number; item: GoalComment };

const LABELS: Record<string, string> = {
  not_started: "not started",
  in_progress: "in progress",
  completed: "completed",
  archived: "archived",
  on_track: "on track",
  at_risk: "at risk",
  off_track: "off track",
  achieved: "achieved",
  unknown: "unknown",
  public: "public",
  private: "private",
  latest: "readings",
  sum: "amounts to add",
  "": "none",
};
const FIELD_NAMES: Record<string, string> = {
  target_date: "target date",
  org_id: "organization",
  base_value: "start",
  target_value: "target",
  check_in_every: "schedule",
  aggregation: "check-ins",
};

const RELATIVE = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 86400],
  ["month", 30 * 86400],
  ["week", 7 * 86400],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

function ago(iso: string): string {
  const seconds = (Date.parse(iso) - Date.now()) / 1000;
  for (const [unit, size] of STEPS) if (Math.abs(seconds) >= size) return RELATIVE.format(Math.round(seconds / size), unit);
  return "just now";
}

function label(value: unknown): string {
  if (value === null || value === undefined) return "none";
  const text = String(value);
  return LABELS[text] ?? text;
}

function describeChanges(changes: unknown): string {
  if (!changes || typeof changes !== "object") return "";
  return Object.entries(changes as Record<string, [unknown, unknown]>)
    .filter(([field]) => field !== "goal" && field !== "cycle" && field !== "parent")
    .map(([field, [from, to]]) => `${FIELD_NAMES[field] ?? field} ${label(from)} → ${label(to)}`)
    .join(", ");
}

/** What happened, as the rest of a sentence after the actor's name. */
function describe(activity: Activity): string {
  const d = activity.data;
  const metric = `"${String(d.metric_name ?? "a metric")}"`;
  const amount = `${String(d.value ?? "")}${d.unit ? ` ${String(d.unit)}` : ""}`;
  const via = d.source === "agent" ? " (AI agent)" : "";
  switch (activity.verb) {
    case "goal_created":
      return d.rolled_from ? `rolled the goal over into ${String(d.cycle ?? "the next cycle")}` : "created the goal";
    case "goal_changed":
      return `changed ${describeChanges(d.changes) || "the goal"}`;
    case "metric_added":
      return `added metric ${metric}`;
    case "metric_changed":
      return `changed ${metric}: ${describeChanges(d.changes) || "details"}`;
    case "metric_removed":
      return `removed metric ${metric}`;
    case "checked_in":
      return (d.adds ? `added ${amount} to ${metric}` : `checked in ${amount} on ${metric}`) + via;
    case "check_in_changed":
      return `edited a check-in on ${metric} (now ${amount})`;
    case "check_in_removed":
      return `removed a check-in of ${amount} on ${metric}`;
    case "health_changed":
      return `health went from ${label(d.from)} to ${label(d.to)}`;
    case "scored":
      return `scored ${String(d.score)} (${label(d.outcome)}) in ${String(d.cycle ?? "the cycle")}${d.rolled_to ? ", rolled over" : ""}`;
    default:
      return activity.verb;
  }
}

/**
 * A goal's activity - its comments and everything that happened to it
 * (check-ins, metric and goal changes, health changes, cycle scores),
 * newest first, with a box to comment. Names come from the goal's org
 * members (platform-org's `/api/v1/org-members`); a personal goal only
 * ever has you. Under a goal's page and in the dashboard's goal drawer.
 */
function GoalActivityPanel({ accessToken, goalId }: GoalActivityPanelProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [version, setVersion] = useState(0);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const goal = await fetchGoal(accessToken, goalId);
      const [activities, comments, people] = await Promise.all([
        fetchActivities(accessToken, goalId),
        fetchComments(accessToken, goalId),
        goal.org_id ? fetchOrgPeople(accessToken, goal.org_id) : Promise.resolve([]),
      ]);
      const me = goal.org_id ? (people.find((p) => p.is_me)?.user_id ?? null) : goal.owner_id;
      return { goal, activities, comments, people: new Map(people.map((p) => [p.user_id, p])), me };
    })()
      .then((result) => !cancelled && setLoaded(result))
      .catch((thrown: unknown) => !cancelled && setError(errorMessage(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, goalId, version]);

  function actorName(activity: Activity | GoalComment): string {
    const id = "author_id" in activity ? activity.author_id : activity.actor_id;
    if (id === null) {
      if ("verb" in activity && activity.verb === "checked_in") return "Ingest URL";
      return "GoalNexa";
    }
    if (id === loaded?.me) return "You";
    const person = loaded?.people.get(id);
    return person?.name ?? person?.email ?? "Someone";
  }

  async function act(run: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await run();
      setVersion((v) => v + 1);
      return true;
    } catch (thrown) {
      setError(errorMessage(thrown));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function handleComment(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim()) return;
    if (await act(() => addComment(accessToken, goalId, draft.trim()))) setDraft("");
  }

  const entries: Entry[] = loaded
    ? [
        ...loaded.activities
          .filter((a) => a.verb !== "commented")
          .map((item) => ({ kind: "activity" as const, at: Date.parse(item.created_at), item })),
        ...loaded.comments.map((item) => ({ kind: "comment" as const, at: Date.parse(item.created_at), item })),
      ].sort((a, b) => b.at - a.at)
    : [];

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Activity</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleComment} className="mb-3">
          <textarea
            className="form-control"
            rows={2}
            placeholder="Write a comment…"
            aria-label="Comment"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-2">
            <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
              Comment
            </Button>
          </div>
        </form>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {loaded === null ? (
          !error && <div className="text-secondary">Loading…</div>
        ) : entries.length === 0 ? (
          <div className="text-secondary">Nothing yet.</div>
        ) : (
          <ul className="list-unstyled mb-0">
            {entries.map((entry) => (
              <li key={`${entry.kind}-${entry.item.id}`} className="py-2 border-top">
                {entry.kind === "comment" ? (
                  <>
                    <div className="d-flex align-items-baseline gap-2">
                      <strong>{actorName(entry.item)}</strong>
                      <span className="text-secondary small" title={new Date(entry.at).toLocaleString()}>
                        {ago(entry.item.created_at)}
                      </span>
                      {entry.item.author_id === loaded.me && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 ms-auto text-danger"
                          disabled={busy}
                          onClick={() => void act(() => deleteComment(accessToken, entry.item.id))}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{entry.item.body}</div>
                  </>
                ) : (
                  <div className="small">
                    <strong>{actorName(entry.item)}</strong> {describe(entry.item)}{" "}
                    <span className="text-secondary" title={new Date(entry.at).toLocaleString()}>
                      · {ago(entry.item.created_at)}
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

export default GoalActivityPanel;
