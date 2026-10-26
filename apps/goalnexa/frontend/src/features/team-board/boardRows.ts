/**
 * How the board's grid is laid out: its rows (the team tree, the totals),
 * its columns (the template's metrics in goal order), and the blocks Over
 * time and the charts draw - pure, from a `Board`.
 */
import type { ChartPoint } from "../../components/charts/BoardCharts";
import type { Board, BoardInstance, BoardMetric, BoardTeam, BoardTotal, CellNumbers, ShownNumbers } from "../../api/teamBoard";
import { periodLabel, type Snap } from "../../lib/periods";
import { PER_LABELS, fmt, shownPct, tipDay, tipTime, type Mode } from "./boardHelpers";

export interface Row {
  key: string;
  /** "group": a team with sub-teams whose total isn't calculated - just its name (Check in mode). */
  kind: "org" | "total" | "group" | "instance";
  label: string;
  depth: number;
  team?: BoardTeam;
  total?: BoardTotal;
  instance?: BoardInstance;
  /** A team with no instance yet - can be ticked to apply the template. */
  missing?: boolean;
  /** A total row: whether it's ticked to be calculated (`Board.total_for`). */
  ticked?: boolean;
  /** A team with sub-teams that has its own copy: one row with its own numbers, and its total (if ticked) under each cell. */
  parent?: boolean;
}

/** A team's (or total's) cells, for Over time and the charts. */
export interface BoardBlock {
  key: string;
  label: string;
  /** "Total" on a total. */
  sub?: string;
  depth: number;
  metrics: Record<string, CellNumbers>;
  /** A team's own copy the user may check in on. */
  canCheckIn?: boolean;
}

export interface Column {
  metric: BoardMetric;
  goalTitle: string;
  /** First column of its goal - draws the group border. */
  first: boolean;
  /** Last metric column of its goal - the goal's "Last update" column follows it. */
  last: boolean;
}

export function goalOrder(board: Board): { id: string; title: string; depth: number }[] {
  const children = new Map<string | null, typeof board.goals>();
  for (const goal of board.goals) {
    const key = goal.parent && board.goals.some((g) => g.id === goal.parent) ? goal.parent : null;
    children.set(key, [...(children.get(key) ?? []), goal]);
  }
  const out: { id: string; title: string; depth: number }[] = [];
  const visit = (parent: string | null, depth: number) => {
    for (const goal of children.get(parent) ?? []) {
      out.push({ id: goal.id, title: goal.title, depth });
      visit(goal.id, depth + 1);
    }
  };
  visit(null, 0);
  return out;
}

/**
 * The board's rows. Targets mode shows every team: a tick on a team's row
 * adds it to the template (or takes it out), a tick on a total calculates
 * it. A team with sub-teams that has its own copy is one row: its own
 * numbers, with its total (if ticked) as a line under each cell. Check in mode shows only what's in play - teams with a copy, the
 * totals that are calculated, and the name of a team with sub-teams that
 * holds them - and counts the teams left out (`notJoined`).
 */
export function buildRows(board: Board, root: string, mode: Mode): { rows: Row[]; notJoined: number } {
  const children = new Map<string | null, BoardTeam[]>();
  const known = new Set(board.teams.map((t) => t.id));
  for (const team of board.teams) {
    const key = team.parent && known.has(team.parent) ? team.parent : null;
    children.set(key, [...(children.get(key) ?? []), team]);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  const targets = mode === "targets";
  const totalFor = new Set(board.total_for ?? ["org"]);
  let notJoined = 0;
  const visit = (team: BoardTeam, depth: number): Row[] => {
    const kids = children.get(team.id) ?? [];
    const instance = board.instances[team.id];
    if (kids.length === 0) {
      if (instance || targets) return [{ key: `team-${team.id}`, kind: "instance", label: team.name, depth, team, instance, missing: !instance }];
      notJoined += 1;
      return [];
    }
    const below = kids.flatMap((kid) => visit(kid, depth + 1));
    const total = board.totals[team.id];
    const ticked = totalFor.has(team.id);
    if (instance) return [{ key: `team-${team.id}`, kind: "instance", label: team.name, depth, team, instance, total, ticked, parent: true }, ...below];
    if (!targets && below.length === 0) return [];
    const head: Row =
      targets || total
        ? { key: `total-${team.id}`, kind: "total", label: team.name, depth, team, total, ticked }
        : { key: `group-${team.id}`, kind: "group", label: team.name, depth, team };
    return [head, ...below];
  };
  const rows: Row[] = [];
  if (!root && (targets || board.totals.org)) {
    rows.push({ key: "org", kind: "org", label: "Whole organization", depth: 0, total: board.totals.org, ticked: totalFor.has("org") });
  }
  const start = root ? board.teams.filter((t) => t.id === root) : children.get(null) ?? [];
  for (const team of start) rows.push(...visit(team, root ? 0 : 1));
  return { rows, notJoined };
}

/** The template's metrics as the board's columns, goal by goal (sub-goals after their goal). */
export function buildColumns(board: Board | null): Column[] {
  if (!board) return [];
  const byGoal = new Map<string, BoardMetric[]>();
  for (const metric of board.metrics) byGoal.set(metric.template_goal, [...(byGoal.get(metric.template_goal) ?? []), metric]);
  return goalOrder(board).flatMap((goal) =>
    (byGoal.get(goal.id) ?? []).map((metric, index, all) => ({
      metric,
      goalTitle: `${"› ".repeat(goal.depth)}${goal.title}`,
      first: index === 0,
      last: index === all.length - 1,
    })),
  );
}

/**
 * "Over time": rows are teams (and totals) -> their goals -> metrics,
 * columns the periods up to the picked day; a cell is what was done in
 * that period (or its last reading), against its target per that period.
 */
/** The board's teams and calculated totals, in row order, with their cells - for Over time and the charts. */
export function boardBlocks(rows: Row[]): BoardBlock[] {
  const blocks: BoardBlock[] = [];
  for (const row of rows) {
    if (row.kind === "group") continue;
    const own = row.kind === "instance" && row.instance?.visible ? row.instance.metrics : null;
    if (own) blocks.push({ key: row.key, label: row.label, depth: row.depth, metrics: own, canCheckIn: !!row.instance?.can_check_in });
    const total = (row.kind !== "instance" || (row.parent && row.ticked)) && row.total ? row.total.metrics : null;
    if (total) {
      blocks.push({ key: `${row.key}-total`, label: row.label, sub: "Total", depth: row.depth, metrics: total });
    }
  }
  return blocks;
}

/** Over time's periods: their first days, from any cell that has them all (a team's always does), and their names. */
export function historyStarts(blocks: BoardBlock[], per: Snap) {
  const sample = blocks.flatMap((b) => Object.values(b.metrics)).find((n) => n.history?.length && n.history.every(Boolean));
  const starts = sample?.history?.map((h) => h!.start) ?? [];
  const label = (start: string) => {
    const [y, m, d] = start.split("-").map(Number);
    return periodLabel(new Date(y, m - 1, d).getTime(), per);
  };
  return { starts, label };
}

/** A Check in cell as one number for its bar - the same number its table cell leads with (`showing`: its shown period's). */
export function chartPoint(numbers: CellNumbers, metric: BoardMetric, showing: boolean): ChartPoint {
  if (showing) {
    const shown = numbers.shown;
    if (!shown) return { value: null, target: null, pct: null };
    const target =
      shown.quota !== null ? shown.quota
      : metric.aggregation === "latest" && !numbers.target_per && numbers.target_value !== numbers.base_value ? numbers.target_value
      : null;
    return { value: shown.value, target, pct: shownPct(shown, numbers, metric) };
  }
  if (numbers.target_value === numbers.base_value) return { value: numbers.current_value, target: null, pct: null };
  if (numbers.target_per) {
    const pace = numbers.pace;
    if (!pace || pace.in_period === false || !pace.quota) return { value: numbers.current_value, target: null, pct: null };
    const done = pace.done ?? 0;
    return { value: done, target: pace.quota, pct: (done / pace.quota) * 100 };
  }
  return { value: numbers.current_value, target: numbers.target_value, pct: numbers.progress };
}

/** The hover details of an "Over time" cell. */
export function periodTipLines(block: BoardBlock, metric: BoardMetric, cell: ShownNumbers | null, label: string, editable: boolean): string[] {
  const lines = [`${block.label}${block.sub ? " · total" : ""} · ${metric.name}`];
  if (!cell) return [...lines, "Not totalled"];
  lines.push(cell.start === cell.last ? label : `${label} (${tipDay.format(new Date(`${cell.start}T00:00`))} – ${tipDay.format(new Date(`${cell.last}T00:00`))})`);
  const unit = metric.unit ? ` ${metric.unit}` : "";
  if (cell.value === null) lines.push("No check-in");
  else {
    const pct = shownPct(cell, block.metrics[metric.id], metric);
    lines.push(`${fmt(cell.value)}${cell.quota !== null ? ` / ${fmt(cell.quota)}` : ""}${unit}${pct !== null ? ` · ${Math.round(pct)}%` : ""}`);
  }
  if (cell.count && cell.last_at) {
    const last = tipTime.format(new Date(cell.last_at));
    lines.push(cell.count === 1 ? `1 check-in, ${last}` : `${cell.count} check-ins, last ${last}`);
  }
  if (editable) lines.push(cell.value === null ? "Click to add" : "Click to change");
  else if (block.sub) lines.push("Calculated from the teams");
  else if (block.canCheckIn && metric.one_per) lines.push(`Counts one check-in ${PER_LABELS[metric.one_per]} - check in from Check in`);
  return lines;
}
