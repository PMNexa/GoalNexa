import { useEffect, useState } from "react";
import type { Goal } from "../../api/goals";
import type { Metric } from "../../api/metrics";
import type { CheckIn } from "../../api/checkIns";
import {
  fetchAll,
  fetchGoals,
  fetchOrgs,
  fetchTeams,
} from "../../api/dashboard";
import {
  getCurrentOrg,
  PERSONAL_ORG,
  subscribeCurrentOrg,
} from "../../lib/currentOrg";
import type { TableData } from "./buildTable";

const CHUNK = 40;

async function loadAll(accessToken: string, goals: Goal[]) {
  const metrics: Metric[] = [];
  const checkIns: CheckIn[] = [];
  const ids = goals.map((g) => g.id);
  for (let i = 0; i < ids.length; i += CHUNK) {
    const part = ids.slice(i, i + CHUNK).join(",");
    metrics.push(
      ...(await fetchAll<Metric>(
        `/api/v1/metrics?filter{goal.in}=${part}`,
        accessToken,
      )),
    );
    checkIns.push(
      ...(await fetchAll<CheckIn>(
        `/api/v1/check-ins?filter{metric.goal.in}=${part}`,
        accessToken,
      )),
    );
  }
  return { metrics, checkIns };
}

/**
 * The check-in table's data: the current organization (the header's, else
 * the first one, else personal goals - following later switches), then its
 * open goals, their metrics and check-ins and the org's team names.
 * `reload()` fetches it all again; `setData` shows a local change at once
 * (a drag's new order).
 */
export function useTableData(accessToken: string) {
  const [orgKey, setOrgKey] = useState<string | null>(null);
  const [data, setData] = useState<TableData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let live = true;
    fetchOrgs(accessToken)
      .then((items) => {
        if (!live) return;
        const stored = getCurrentOrg();
        const valid =
          stored === PERSONAL_ORG || items.some((org) => org.id === stored);
        setOrgKey(valid && stored ? stored : (items[0]?.id ?? PERSONAL_ORG));
      })
      .catch((e) => live && setError(String(e?.message ?? e)));
    const unsubscribe = subscribeCurrentOrg(() => {
      const next = getCurrentOrg();
      if (next) setOrgKey(next);
    });
    return () => {
      live = false;
      unsubscribe();
    };
  }, [accessToken]);

  useEffect(() => {
    if (orgKey === null) return;
    let live = true;
    setError(null);
    const org = orgKey === PERSONAL_ORG ? null : orgKey;
    Promise.all([fetchGoals(accessToken, org), org ? fetchTeams(accessToken, org) : []])
      .then(async ([all, teams]) => {
        const goals = all.filter((g) => g.status !== "archived");
        const rest = await loadAll(accessToken, goals);
        const teamNames = new Map(teams.map((team) => [team.id, team.name]));
        if (live) setData({ org: orgKey, goals, ...rest, teamNames });
      })
      .catch((e) => live && setError(String(e?.message ?? e)));
    return () => {
      live = false;
    };
  }, [accessToken, orgKey, version]);

  const reload = () => setVersion((v) => v + 1);
  return { orgKey, data, setData, error, reload };
}
