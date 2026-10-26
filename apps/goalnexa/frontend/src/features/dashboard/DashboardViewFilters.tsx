import { FormLabel, FormSelect } from "platform-core";
import type { Cycle } from "../../api/cycles";
import type { TeamOption } from "../../api/dashboard";
import { SNAP_LABELS, type Snap } from "../../lib/periods";
import { ALL_CYCLES, NO_CYCLE } from "./dashboardState";

export interface DashboardViewFiltersProps {
  /** The org's cycles - no "Cycle" select without any. */
  cycles: Cycle[];
  /** A cycle's id, `ALL_CYCLES` or `NO_CYCLE`. */
  cycleKey: string;
  onCycle: (cycleKey: string) => void;
  /** "As logged" (null) or the period the charts snap to. */
  snap: Snap | null;
  onSnap: (snap: Snap | null) => void;
  /** The org's teams - no "Team" select without any. */
  teams: TeamOption[];
  /** "" = every goal, else a team id. */
  teamKey: string;
  onTeam: (teamKey: string) => void;
}

/** The selects at the top of the dashboard's Filters card: cycle, "Show check-ins by", team. */
function DashboardViewFilters({ cycles, cycleKey, onCycle, snap, onSnap, teams, teamKey, onTeam }: DashboardViewFiltersProps) {
  return (
    <>
      {cycles.length > 0 && (
        <div className="mb-3">
          <FormLabel htmlFor="dashboard-cycle">Cycle</FormLabel>
          <FormSelect
            id="dashboard-cycle"
            value={cycleKey}
            onChange={(event) => onCycle(event.target.value)}
          >
            <option value={ALL_CYCLES}>All goals</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.name}
                {cycle.status === "closed" ? " (closed)" : cycle.status === "planning" ? " (planning)" : ""}
              </option>
            ))}
            <option value={NO_CYCLE}>Not in a cycle</option>
          </FormSelect>
        </div>
      )}

      <div className="mb-3">
        <FormLabel htmlFor="dashboard-snap">Show check-ins by</FormLabel>
        <FormSelect
          id="dashboard-snap"
          value={snap ?? ""}
          onChange={(event) => onSnap((event.target.value || null) as Snap | null)}
        >
          <option value="">As logged</option>
          {(Object.keys(SNAP_LABELS) as Snap[]).map((per) => (
            <option key={per} value={per}>
              {SNAP_LABELS[per]}
            </option>
          ))}
        </FormSelect>
        {snap && (
          <small className="form-hint">
            Lines keep each metric's last reading per {snap}; amounts to add also show as bars per {snap}.
          </small>
        )}
      </div>

      {teams.length > 0 && (
        <div className="mb-3">
          <FormLabel htmlFor="dashboard-team">Team</FormLabel>
          <FormSelect
            id="dashboard-team"
            value={teamKey}
            onChange={(event) => onTeam(event.target.value)}
          >
            <option value="">All goals</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </FormSelect>
        </div>
      )}
    </>
  );
}

export default DashboardViewFilters;
