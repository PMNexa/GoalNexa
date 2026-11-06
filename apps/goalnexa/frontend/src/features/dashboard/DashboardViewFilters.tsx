import { FormLabel, FormSelect, useT } from "platform-core";
import type { Cycle } from "../../api/cycles";
import type { TeamOption } from "../../api/dashboard";
import type { Snap } from "../../lib/periods";
import { ALL_CYCLES, NO_CYCLE } from "./dashboardState";
import messages from "./messages";

const SNAPS: Snap[] = ["day", "week", "month", "quarter", "year"];

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
  const t = useT(messages);
  return (
    <>
      {cycles.length > 0 && (
        <div className="mb-3">
          <FormLabel htmlFor="dashboard-cycle">{t("cycle")}</FormLabel>
          <FormSelect
            id="dashboard-cycle"
            value={cycleKey}
            onChange={(event) => onCycle(event.target.value)}
          >
            <option value={ALL_CYCLES}>{t("allGoals")}</option>
            {cycles.map((cycle) => (
              <option key={cycle.id} value={cycle.id}>
                {cycle.status === "closed"
                  ? t("cycleClosed", { name: cycle.name })
                  : cycle.status === "planning"
                    ? t("cyclePlanning", { name: cycle.name })
                    : cycle.name}
              </option>
            ))}
            <option value={NO_CYCLE}>{t("notInCycle")}</option>
          </FormSelect>
        </div>
      )}

      <div className="mb-3">
        <FormLabel htmlFor="dashboard-snap">{t("showCheckInsBy")}</FormLabel>
        <FormSelect
          id="dashboard-snap"
          value={snap ?? ""}
          onChange={(event) => onSnap((event.target.value || null) as Snap | null)}
        >
          <option value="">{t("asLogged")}</option>
          {SNAPS.map((per) => (
            <option key={per} value={per}>
              {t(`snap_${per}`)}
            </option>
          ))}
        </FormSelect>
        {snap && (
          <small className="form-hint">
            {t(`snapHint_${snap}`)}
          </small>
        )}
      </div>

      {teams.length > 0 && (
        <div className="mb-3">
          <FormLabel htmlFor="dashboard-team">{t("team")}</FormLabel>
          <FormSelect
            id="dashboard-team"
            value={teamKey}
            onChange={(event) => onTeam(event.target.value)}
          >
            <option value="">{t("allGoals")}</option>
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
