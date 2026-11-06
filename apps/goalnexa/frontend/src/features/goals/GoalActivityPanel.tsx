import { useEffect, useState, type SubmitEvent } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, formatDateTime, formatRelative, useT, type Translate } from "platform-core";
import { errorMessage, fetchGoal, fetchOrgPeople, type OrgPerson } from "../../api/goalMembers";
import { addComment, deleteComment, fetchActivities, fetchComments, type Activity, type GoalComment } from "../../api/feed";
import type { Goal } from "../../api/goals";
import messages from "./GoalActivityPanel.messages";

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

type T = Translate<(typeof messages)["en"]>;
type Key = keyof (typeof messages)["en"] & string;

function has(key: string): key is Key {
  return key in messages.en;
}

function ago(iso: string, t: T): string {
  const at = Date.parse(iso);
  if (Math.abs(at - Date.now()) < 60_000) return t("justNow");
  return formatRelative(at, new Date(), t.locale);
}

/** An API value as shown (a status, health, outcome, ...); anything else as is. */
function label(value: unknown, t: T): string {
  if (value === null || value === undefined || value === "") return t("none");
  const text = String(value);
  const key = `label_${text}`;
  return has(key) ? t(key) : text;
}

function describeChanges(changes: unknown, t: T): string {
  if (!changes || typeof changes !== "object") return "";
  return Object.entries(changes as Record<string, [unknown, unknown]>)
    .filter(([field]) => field !== "goal" && field !== "cycle" && field !== "parent")
    .map(([field, [from, to]]) => {
      const snap = (value: unknown) => {
        if (!value) return t("snapAny");
        const key = `snap_${String(value)}`;
        return has(key) ? t(key) : t("snapOther", { value: String(value) });
      };
      const say = (value: unknown) => (field === "snap_to" ? snap(value) : label(value, t));
      const name = `field_${field}`;
      return t("change", { field: has(name) ? t(name) : field, from: say(from), to: say(to) });
    })
    .join(", ");
}

/** What happened, as the rest of a sentence after the actor's name. */
function describe(activity: Activity, t: T): string {
  const d = activity.data;
  const metric = `"${d.metric_name ? String(d.metric_name) : t("aMetric")}"`;
  const amount = `${String(d.value ?? "")}${d.unit ? ` ${String(d.unit)}` : ""}`;
  const via = d.source === "agent" ? t("viaAgent") : d.source === "mobile" ? t("viaMobile") : "";
  switch (activity.verb) {
    case "goal_created":
      return d.rolled_from ? t("rolledOverInto", { cycle: d.cycle ? String(d.cycle) : t("nextCycle") }) : t("created");
    case "goal_changed":
      return t("goalChanged", { what: describeChanges(d.changes, t) || t("theGoal") });
    case "metric_added":
      return t("metricAdded", { metric });
    case "metric_changed":
      return t("metricChanged", { metric, what: describeChanges(d.changes, t) || t("details") });
    case "metric_removed":
      return t("metricRemoved", { metric });
    case "checked_in":
      // One reading per period: a check-in replaces the period's earlier one (or was itself replaced by a later one).
      if (d.replaces !== undefined) return t("checkedInReplacing", { amount, metric, old: String(d.replaces), via });
      if (d.replaced) return t("checkedInReplaced", { amount, metric, via });
      return t(d.adds ? "added" : "checkedIn", { amount, metric, via });
    case "check_in_changed":
      return t("checkInChanged", { metric, amount });
    case "check_in_removed":
      return t("checkInRemoved", { metric, amount });
    case "health_changed":
      return t("healthChanged", { from: label(d.from, t), to: label(d.to, t) });
    case "scored":
      return t("scored", {
        score: String(d.score),
        outcome: label(d.outcome, t),
        cycle: d.cycle ? String(d.cycle) : t("theCycle"),
        rolled: d.rolled_to ? t("rolledOver") : "",
      });
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
  const t = useT(messages);
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
      if ("verb" in activity && activity.verb === "checked_in") return t("ingest");
      return "GoalNexa";
    }
    if (id === loaded?.me) return t("you");
    const person = loaded?.people.get(id);
    return person?.name ?? person?.email ?? t("someone");
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
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardBody>
        <form onSubmit={handleComment} className="mb-3">
          <textarea
            className="form-control"
            rows={2}
            placeholder={t("placeholder")}
            aria-label={t("commentLabel")}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          <div className="mt-2">
            <Button type="submit" variant="primary" disabled={busy || !draft.trim()}>
              {t("comment")}
            </Button>
          </div>
        </form>
        {error && (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        )}
        {loaded === null ? (
          !error && <div className="text-secondary">{t("loading")}</div>
        ) : entries.length === 0 ? (
          <div className="text-secondary">{t("empty")}</div>
        ) : (
          <ul className="list-unstyled mb-0">
            {entries.map((entry) => (
              <li key={`${entry.kind}-${entry.item.id}`} className="py-2 border-top">
                {entry.kind === "comment" ? (
                  <>
                    <div className="d-flex align-items-baseline gap-2">
                      <strong>{actorName(entry.item)}</strong>
                      <span className="text-secondary small" title={formatDateTime(entry.at, undefined, t.locale)}>
                        {ago(entry.item.created_at, t)}
                      </span>
                      {entry.item.author_id === loaded.me && (
                        <button
                          type="button"
                          className="btn btn-link btn-sm p-0 ms-auto text-danger"
                          disabled={busy}
                          onClick={() => void act(() => deleteComment(accessToken, entry.item.id))}
                        >
                          {t("delete")}
                        </button>
                      )}
                    </div>
                    <div style={{ whiteSpace: "pre-wrap" }}>{entry.item.body}</div>
                  </>
                ) : (
                  <div className="small">
                    <strong>{actorName(entry.item)}</strong> {describe(entry.item, t)}{" "}
                    <span className="text-secondary" title={formatDateTime(entry.at, undefined, t.locale)}>
                      · {ago(entry.item.created_at, t)}
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
