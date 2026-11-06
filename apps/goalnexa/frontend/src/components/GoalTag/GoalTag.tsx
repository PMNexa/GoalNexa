import { useT } from "platform-core";
import type { Goal } from "../../api/goals";
import messages from "./GoalTag.messages";

/**
 * A small chip after a goal's title: "Total" on a team total, else the
 * goal's team (`team`, from `goalTeamName`) - a template makes one goal
 * per team under the same title. Nothing for any other goal.
 */
function GoalTag({ goal, team }: { goal: Goal; team: string | null }) {
  const t = useT(messages);
  if (goal.is_rollup) {
    return (
      <span className="gn-goal-tag is-total" title={t("totalTitle")}>
        {t("total")}
      </span>
    );
  }
  return team ? (
    <span className="gn-goal-tag" title={t("teamTitle", { team })}>
      {team}
    </span>
  ) : null;
}

export default GoalTag;
