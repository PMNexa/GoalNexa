import type { Goal } from "../../api/goals";

/**
 * A small chip after a goal's title: "Total" on a team total, else the
 * goal's team (`team`, from `goalTeamName`) - a template makes one goal
 * per team under the same title. Nothing for any other goal.
 */
function GoalTag({ goal, team }: { goal: Goal; team: string | null }) {
  if (goal.is_rollup) {
    return (
      <span className="gn-goal-tag is-total" title="Team total - added up from the teams' goals, read-only">
        Total
      </span>
    );
  }
  return team ? (
    <span className="gn-goal-tag" title={`Team: ${team}`}>
      {team}
    </span>
  ) : null;
}

export default GoalTag;
