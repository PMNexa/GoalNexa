import { useEffect, useState } from "react";
import { Button, Card, CardBody, CardHeader, CardTitle, useT, type Translate } from "platform-core";
import type { Goal, GoalVisibility } from "../../api/goals";
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
} from "../../api/goalMembers";
import messages from "./GoalSharingPanel.messages";

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

type T = Translate<(typeof messages)["en"]>;

const VISIBILITY_HINTS = { public: "hintPublic", private: "hintPrivate", team: "hintTeam" } as const satisfies Record<GoalVisibility, string>;

function personLabel(t: T, person: OrgPerson | undefined, userId: string): string {
  return person?.name ?? person?.email ?? t("unknownUser", { id: userId.slice(0, 8) });
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
  const t = useT(messages);
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
          <CardTitle>{t("title")}</CardTitle>
        </CardHeader>
        <CardBody className="text-secondary">
          {t("personal")}
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
      ? t(loaded?.goal.visibility === "private" ? "leavePrivateConfirm" : "leaveConfirm")
      : t("removeConfirm", { name: personLabel(t, byUser.get(member.user_id), member.user_id) });
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
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      {error && (
        <CardBody className="border-bottom">
          <div className="text-danger" role="alert">
            {error}
          </div>
        </CardBody>
      )}
      {loaded === null ? (
        !error && <CardBody className="text-secondary">{t("loading")}</CardBody>
      ) : (
        <>
          <CardBody className="border-bottom">
            <label className="form-label" htmlFor={`goal-visibility-${goalId}`}>
              {t("visibility")}
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
                <option value="public">{t("public")}</option>
                <option value="private">{t("private")}</option>
                {(loaded.goal.team_id || loaded.goal.visibility === "team") && <option value="team">{t("team")}</option>}
              </select>
            ) : (
              <div id={`goal-visibility-${goalId}`}>{t(loaded.goal.visibility)}</div>
            )}
            <small className="form-hint">{t(VISIBILITY_HINTS[loaded.goal.visibility], { org: loaded.orgName })}</small>
          </CardBody>
          <div className="table-responsive">
            <table className="table table-vcenter card-table">
              <thead>
                <tr>
                  <th>{t("member")}</th>
                  <th className="w-1" />
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    {personLabel(t, byUser.get(loaded.goal.owner_id), loaded.goal.owner_id)}
                    {loaded.goal.owner_id === me?.user_id && <span className="text-secondary"> {t("you")}</span>}
                    <span className="badge bg-secondary-lt ms-2">{t("owner")}</span>
                  </td>
                  <td />
                </tr>
                {loaded.members.map((member) => {
                  const self = member.user_id === me?.user_id;
                  return (
                    <tr key={member.id}>
                      <td>
                        {personLabel(t, byUser.get(member.user_id), member.user_id)}
                        {self && <span className="text-secondary"> {t("you")}</span>}
                      </td>
                      <td className="text-nowrap">
                        {(isOwner || self) && (
                          <Button variant="danger" outline disabled={busy} onClick={() => handleRemove(member)}>
                            {self ? t("leave") : t("remove")}
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
                <div className="text-secondary">{t("everyoneOn", { org: loaded.orgName })}</div>
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
                    aria-label={t("memberToAdd")}
                    value={adding}
                    disabled={busy}
                    onChange={(event) => setAdding(event.target.value)}
                  >
                    <option value="">{t("addPlaceholder", { org: loaded.orgName })}</option>
                    {candidates.map((person) => (
                      <option key={person.user_id} value={person.user_id}>
                        {personLabel(t, person, person.user_id)}
                        {person.name && person.email ? ` (${person.email})` : ""}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" variant="primary" disabled={busy || !adding}>
                    {t("add")}
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
