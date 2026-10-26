import { goalTeamName } from "../../api/dashboard";
import GoalTag from "../../components/GoalTag";
import type { TableChartCard } from "./TableCharts";
import type { Table } from "./buildTable";

/** The chart view: per goal, its % and each metric's; a tracked metric on its own. */
export function chartCards(
  table: Table | null,
  teamNames: Map<string, string> | undefined,
): TableChartCard[] {
  if (!table) return [];
  return table.rows.flatMap((row) => {
    if (row.kind !== "goal") return [];
    const metrics = table.rows.filter((r) => r.kind === "metric" && r.goalId === row.id);
    const scored = metrics.filter((m) => !m.tracked);
    const cards: TableChartCard[] = [];
    if (scored.length > 0)
      cards.push({
        key: row.key,
        title: (
          <>
            {row.label}
            {row.goal && teamNames && <GoalTag goal={row.goal} team={goalTeamName(row.goal, teamNames)} />}
          </>
        ),
        unit: "%",
        percent: true,
        lines: [
          ...(scored.length > 1 ? [{ key: row.key, label: "Goal", slot: 0, points: row.points }] : []),
          ...scored.map((m, i) => ({ key: m.key, label: m.label, slot: i + 1, points: m.points })),
        ],
      });
    for (const m of metrics.filter((m) => m.tracked))
      cards.push({
        key: m.key,
        title: (
          <>
            {row.label}
            {row.goal && teamNames && <GoalTag goal={row.goal} team={goalTeamName(row.goal, teamNames)} />} · {m.label}
            {m.unit && <span className="text-secondary fw-normal"> ({m.unit})</span>}
          </>
        ),
        unit: m.unit ?? "",
        percent: false,
        lines: [{ key: m.key, label: m.label, slot: 1, points: m.points }],
      });
    return cards;
  });
}
