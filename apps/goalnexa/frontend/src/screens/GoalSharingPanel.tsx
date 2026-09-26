import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle } from "platform-core";
import type { Goal, GoalVisibility } from "../lib/api/goals";
import {
  addGoalMember,
  errorMessage,
  fetchGoal,
  fetchGoalMembers,
  fetchOrgName,
  fetchOrgPeople,
  removeGoalMember,
  setGoalVisibility,
  type GoalMember,
  type OrgPerson,
} from "../lib/api/goalMembers";

export interface GoalSharingPanelProps {
  accessToken: string;
  goalId: string;
  /** Fires after the goal's visibility changed - e.g. to reload a detail view showing it. */
  onChanged?: () => void;
  /** Fires after the signed-in user left a private goal (it's out of their reach now) - the host owns what comes next. */
  onLeft?: () => void;
}

interface Loaded {
  goal: Goal;
  orgName: string;
  people: OrgPerson[];
  members: GoalMember[];
}

const VISIBILITY_HINTS: Record<GoalVisibility, (org: string) => string> = {
  public: (org) => `Everyone in ${org} sees this goal.`,
  private: () => "Only the owner and the members below see this goal.",
};

function personLabel(person: OrgPerson | undefined, userId: string): string {
  return person?.name ?? person?.email ?? `Unknown user (${userId.slice(0, 8)})`;
}

/**
 * Who sees a goal: its visibility (public = the whole org, private = the
 * owner and the goal's members) and its members. Shown under a goal's
 * detail page and in the dashboard's goal drawer. Only the owner changes
 * the visibility and adds or removes members (from the goal's org); a
 * member can leave. A personal goal has neither - it's only its owner's.
 * The API enforces all of it; this only hides what would fail.
 */
/** The panel's data - `"personal"` for a goal with no org (nothing to share). */
async function loadSharing(accessToken: string, goalId: string): Promise<Loaded | "personal"> {
  const goal = await fetchGoal(accessToken, goalId);
  if (goal.org_id === null) return "personal";
  const [orgName, people, members] = await Promise.all([
    fetchOrgName(accessToken, goal.org_id),
    fetchOrgPeople(accessToken, goal.org_id),
    fetchGoalMembers(accessToken, goalId),
  ]);
  return { goal, orgName, people, members };
}

function GoalSharingPanel({ accessToken, goalId, onChanged, onLeft }: GoalSharingPanelProps) {
  const [view, setView] = useState<Loaded | "personal" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSharing(accessToken, goalId)
      .then((next) => !cancelled && setView(next))
      .catch((thrown: unknown) => !cancelled && setError(errorMessage(thrown)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, goalId]);

  async function act(action: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setError(null);
    try {
      await action();
      after?.();
      setView(await loadSharing(accessToken, goalId));
    } catch (thrown) {
      setError(errorMessage(thrown));
    } finally {
      setBusy(false);
    }
  }

  if (view === "personal") {
    return (
      <Card className="mt-3">
        <CardHeader>
          <CardTitle>Sharing</CardTitle>
        </CardHeader>
        <CardBody className="text-secondary">
          A personal goal - only you see it. Put it in an organization to share it.
        </CardBody>
      </Card>
    );
  }

  const loaded = view;
  const me = loaded?.people.find((person) => person.is_me);
  const isOwner = loaded !== null && me?.user_id === loaded.goal.owner_id;
  const byUser = new Map(loaded?.people.map((person) => [person.user_id, person]));
  const memberIds = new Set(loaded?.members.map((member) => member.user_id));
  const candidates =
    loaded?.people.filter((person) => person.user_id !== loaded.goal.owner_id && !memberIds.has(person.user_id)) ?? [];

  function handleRemove(member: GoalMember) {
    const self = member.user_id === me?.user_id;
    const question = self
      ? "Leave this goal?" + (loaded?.goal.visibility === "private" ? " You won't see it anymore." : "")
      : `Remove ${personLabel(byUser.get(member.user_id), member.user_id)} from this goal?`;
    if (!window.confirm(question)) return;
    if (self && loaded?.goal.visibility === "private") {
      // The goal is out of reach once we're off it - no refresh to do.
      setBusy(true);
      removeGoalMember(accessToken, member.id)
        .then(() => onLeft?.())
        .catch((thrown: unknown) => setError(errorMessage(thrown)))
        .finally(() => setBusy(false));
      return;
    }
    void act(() => removeGoalMember(accessToken, member.id));
  }

  return (
    <Card className="mt-3">
      <CardHeader>
        <CardTitle>Sharing</CardTitle>
      </CardHeader>
      {error && (
        <CardBody className="border-bottom">
          <div className="text-danger" role="alert">
            {error}
          </div>
        </CardBody>
      )}
      {loaded === null ? (
        !error && <CardBody className="text-secondary">Loading…</CardBody>
      ) : (
        <>
          <CardBody className="border-bottom">
            <label className="form-label" htmlFor={`goal-visibility-${goalId}`}>
              Visibility
            </label>
            {isOwner ? (
              <select
                id={`goal-visibility-${goalId}`}
                className="form-select form-select-sm w-auto"
                value={loaded.goal.visibility}
                disabled={busy}
                onChange={(event) => {
                  const visibility = event.target.value as GoalVisibility;
                  void act(() => setGoalVisibility(accessToken, goalId, visibility), onChanged);
                }}
              >
                <option value="public">Public</option>
                <option value="private">Private</option>
              </select>
            ) : (
              <div id={`goal-visibility-${goalId}`}>{loaded.goal.visibility === "public" ? "Public" : "Private"}</div>
            )}
            <small className="form-hint">{VISIBILITY_HINTS[loaded.goal.visibility](loaded.orgName)}</small>
          </CardBody>
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="w-1" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {personLabel(byUser.get(loaded.goal.owner_id), loaded.goal.owner_id)}
                    {loaded.goal.owner_id === me?.user_id && <span className="text-secondary"> (you)</span>}
                    <span className="badge bg-secondary-lt ms-2">Owner</span>
                  </td>
                  <td />
                </tr>
                {loaded.members.map((member) => {
                  const self = member.user_id === me?.user_id;
                  return (
                    <tr key={member.id}>
                      <td>
                        {personLabel(byUser.get(member.user_id), member.user_id)}
                        {self && <span className="text-secondary"> (you)</span>}
                      </td>
                      <td className="text-nowrap">
                        {(isOwner || self) && (
                          <Button variant="danger" outline disabled={busy} onClick={() => handleRemove(member)}>
                            {self ? "Leave" : "Remove"}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {isOwner && (
            <CardBody className="border-top">
              {candidates.length === 0 ? (
                <div className="text-secondary">Everyone in {loaded.orgName} is already on this goal.</div>
              ) : (
                <form
                  className="d-flex gap-2"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (!adding) return;
                    void act(
                      () => addGoalMember(accessToken, goalId, adding),
                      () => setAdding(""),
                    );
                  }}
                >
                  <select
                    className="form-select form-select-sm"
                    aria-label="Member to add"
                    value={adding}
                    disabled={busy}
                    onChange={(event) => setAdding(event.target.value)}
                  >
                    <option value="">Add a member of {loaded.orgName}…</option>
                    {candidates.map((person) => (
                      <option key={person.user_id} value={person.user_id}>
                        {personLabel(person, person.user_id)}
                        {person.name && person.email ? ` (${person.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="primary" disabled={busy || !adding}>
                    Add
                  </Button>
                </form>
              )}
            </CardBody>
          )}
        </>
      )}
    </Card>
  );
}

export default GoalSharingPanel;
