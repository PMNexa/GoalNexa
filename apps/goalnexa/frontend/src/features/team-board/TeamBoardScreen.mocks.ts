/**
 * A realistic team board for stories: Acme's "Sales targets" template with
 * one goal ("Grow revenue") and two metrics - Revenue (a reading, $100k
 * target for the whole goal) and Calls (an amount, 50 per week). The team
 * tree: Sales (with its own copy and a ticked total) -> North, South, West
 * (West doesn't run the template yet), and Marketing (its copy is the
 * team's own, only it can see its numbers). Totals: the whole organization
 * and Sales. `boardHandlers` answers the board call like the backend does -
 * `shown` with `show`, `history` with `periods` too.
 */
import { delay, http, HttpResponse, type HttpHandler } from "msw";
import type {
  Board,
  BoardInstance,
  BoardMetric,
  BoardTeam,
  BoardTotal,
  CellNumbers,
  GoalTemplate,
  ShownNumbers,
} from "../../api/teamBoard";
import type { TeamOption } from "../../api/dashboard";
import { nextPeriodStart, periodLabel, periodStart, type Snap } from "../../lib/periods";
import { ME, orgs } from "../../storybook/fixtures";

const ORG = orgs[0].id;
const HOUR = 3_600_000;
const NOW = Date.now();

export const salesTemplate: GoalTemplate = {
  id: "0a000000-0000-7000-8000-000000000001",
  org_id: ORG,
  title: "Sales targets",
  description: "Every sales team's revenue and calls.",
  owner_id: ME,
};
/** A template with no goals yet - the board offers "Set it up". */
export const emptyTemplate: GoalTemplate = {
  id: "0a000000-0000-7000-8000-000000000002",
  org_id: ORG,
  title: "Support quality",
  description: "",
  owner_id: ME,
};
export const templates: GoalTemplate[] = [salesTemplate, emptyTemplate];

const team = (n: number, name: string, parent: string | null): BoardTeam => ({
  id: `0b000000-0000-7000-8000-00000000000${n}`,
  name,
  parent,
});
const SALES = team(1, "Sales", null);
const NORTH = team(2, "North", SALES.id);
const SOUTH = team(3, "South", SALES.id);
const WEST = team(4, "West", SALES.id);
const MARKETING = team(5, "Marketing", null);
export const boardTeams: BoardTeam[] = [SALES, NORTH, SOUTH, WEST, MARKETING];
/** The org's teams as `GET teams` lists them (the template wizard's Teams step). */
export const orgTeams: TeamOption[] = boardTeams.map(({ id, name, parent }) => ({ id, name, parent }));

const GOAL = "0c000000-0000-7000-8000-000000000001";
export const revenueMetric: BoardMetric = {
  id: "0d000000-0000-7000-8000-000000000001",
  template_goal: GOAL,
  parent: null,
  name: "Revenue",
  unit: "$",
  aggregation: "latest",
  rollup: "sum",
  default_target: 100000,
  target_per: "",
  count_days: "all",
  progress_by: "total",
  one_per: "",
  snap_to: "",
};
export const callsMetric: BoardMetric = {
  id: "0d000000-0000-7000-8000-000000000002",
  template_goal: GOAL,
  parent: null,
  name: "Calls",
  unit: "calls",
  aggregation: "sum",
  rollup: "sum",
  default_target: 50,
  target_per: "week",
  count_days: "weekdays",
  progress_by: "total",
  one_per: "",
  snap_to: "",
};

/** Per team: revenue (start, now, target) and calls (this week, in total, the weeks' targets so far). */
const NUMBERS: Record<string, { base: number; revenue: number; target: number; week: number; calls: number; cumulative: number; seed: number }> = {
  [SALES.id]: { base: 0, revenue: 21000, target: 30000, week: 20, calls: 140, cumulative: 150, seed: 1 },
  [NORTH.id]: { base: 0, revenue: 64000, target: 100000, week: 41, calls: 280, cumulative: 300, seed: 2 },
  [SOUTH.id]: { base: 0, revenue: 23000, target: 80000, week: 12, calls: 150, cumulative: 300, seed: 3 },
  [MARKETING.id]: { base: 0, revenue: 9000, target: 20000, week: 30, calls: 120, cumulative: 150, seed: 4 },
};

let ids = 100;
const metricId = () => `0e000000-0000-7000-8000-000000000${ids++}`;

function revenueCell(n: (typeof NUMBERS)[string]): CellNumbers {
  return {
    id: metricId(),
    base_value: n.base,
    target_value: n.target,
    current_value: n.revenue,
    progress: ((n.revenue - n.base) / (n.target - n.base)) * 100,
    check_in_due_at: n.seed === 3 ? new Date(NOW - 2 * HOUR).toISOString() : new Date(NOW + 48 * HOUR).toISOString(),
    last_checked_in_at: new Date(NOW - n.seed * 20 * HOUR).toISOString(),
    target_per: "",
    period_value: null,
    cumulative_target: null,
    expected_value: null,
    hit_rate: null,
    streak: null,
    pace: { per: "", per_day: Math.round((n.target - n.revenue) / 50), per_week: Math.round(((n.target - n.revenue) / 50) * 7) },
  };
}

function callsCell(n: (typeof NUMBERS)[string]): CellNumbers {
  return {
    id: metricId(),
    base_value: 0,
    target_value: 50,
    current_value: n.calls,
    progress: (n.calls / n.cumulative) * 100,
    check_in_due_at: null,
    last_checked_in_at: new Date(NOW - n.seed * 6 * HOUR).toISOString(),
    target_per: "week",
    period_value: n.week,
    cumulative_target: n.cumulative,
    expected_value: n.cumulative,
    hit_rate: n.seed * 20,
    streak: n.seed % 3,
    pace: { per: "week", in_period: true, period_label: "this week", done: n.week, quota: 50, left: Math.max(0, 50 - n.week), days_left: 3 },
  };
}

function instance(teamId: string, extra: Partial<BoardInstance> = {}): BoardInstance {
  const n = NUMBERS[teamId];
  return {
    visible: true,
    goals: { [GOAL]: `0f000000-0000-7000-8000-00000000000${n.seed}` },
    metrics: { [revenueMetric.id]: revenueCell(n), [callsMetric.id]: callsCell(n) },
    root: `0f000000-0000-7000-8000-00000000000${n.seed}`,
    visibility: "public",
    status: "in_progress",
    can_check_in: true,
    can_set_targets: true,
    last_update: {
      [GOAL]: {
        on_day: n.seed === 2 ? new Date(NOW - HOUR).toISOString() : null,
        last: new Date(NOW - n.seed * 20 * HOUR).toISOString(),
      },
    },
    ...extra,
  };
}

/** A total over `teamIds`: the teams' numbers added up, with a planned target on revenue. */
function total(teamIds: string[], planned: number | null, updated: number): BoardTotal {
  const ns = teamIds.map((id) => NUMBERS[id]);
  const sum = (f: (n: (typeof ns)[number]) => number) => ns.reduce((acc, n) => acc + f(n), 0);
  const revenue = revenueCell({ base: 0, revenue: sum((n) => n.revenue), target: planned ?? sum((n) => n.target), week: 0, calls: 0, cumulative: 0, seed: 9 });
  const calls = callsCell({ base: 0, revenue: 0, target: 0, week: sum((n) => n.week), calls: sum((n) => n.calls), cumulative: sum((n) => n.cumulative), seed: 9 });
  calls.target_value = 50 * ns.length;
  calls.pace = { ...calls.pace!, quota: 50 * ns.length, left: Math.max(0, 50 * ns.length - sum((n) => n.week)) };
  return {
    goals: { [GOAL]: metricId() },
    metrics: {
      [revenueMetric.id]: { ...revenue, check_in_due_at: null, planned_target: planned, teams_target: sum((n) => n.target) },
      [callsMetric.id]: { ...calls, planned_target: null, teams_target: 50 * ns.length },
    },
    can_plan: true,
    updated: { [GOAL]: { teams: ns.length, updated } },
  };
}

/** The board as `GET goal-templates/<id>/board` answers without `show`. */
export function makeBoard(extra: Partial<Board> = {}): Board {
  ids = 100;
  return {
    template: { id: salesTemplate.id, title: salesTemplate.title, org_id: ORG },
    cycle: "04000000-0000-7000-8000-000000000001",
    show: "",
    can_manage: true,
    goals: [{ id: GOAL, parent: null, title: "Grow revenue" }],
    metrics: [revenueMetric, callsMetric],
    teams: boardTeams,
    instances: {
      [SALES.id]: instance(SALES.id),
      [NORTH.id]: instance(NORTH.id),
      [SOUTH.id]: instance(SOUTH.id),
      [MARKETING.id]: instance(MARKETING.id, { visibility: "team", can_check_in: false, can_set_targets: false }),
    },
    totals: {
      org: total([SALES.id, NORTH.id, SOUTH.id, MARKETING.id], 250000, 1),
      [SALES.id]: total([SALES.id, NORTH.id, SOUTH.id], null, 1),
    },
    total_for: ["org", SALES.id],
    ...extra,
  };
}

/** A member's view: no Own/Total ticks, no template editing, check-ins only on their own team. */
export function memberBoard(): Board {
  const board = makeBoard({ can_manage: false });
  for (const [id, inst] of Object.entries(board.instances)) {
    inst.can_set_targets = false;
    inst.can_check_in = id === NORTH.id;
  }
  for (const t of Object.values(board.totals)) t.can_plan = false;
  return board;
}

const day = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** One cell in the period starting at `start`: a made-up but steady number per team and period (a reading climbs to `reading`). */
function shownCell(metric: BoardMetric, seed: number, reading: number, start: number, per: Snap, index: number, count: number): ShownNumbers {
  const last = nextPeriodStart(start, per) - 12 * HOUR;
  const wobble = ((seed * 7 + index * 3) % 5) - 2;
  const scale = { day: 1 / 5, week: 1, month: 4, quarter: 13, year: 52 }[per];
  const empty = (seed + index) % 6 === 0;
  const value =
    empty ? null
    : metric.aggregation === "sum" ? Math.max(0, Math.round((40 + wobble * 6 + seed * 2) * scale))
    : Math.round((reading * (0.55 + (0.45 * (index + 1)) / count) + wobble * 300) / 100) * 100;
  return {
    start: day(start),
    last: day(last),
    value,
    quota: metric.target_per === per ? 50 : null,
    count: value === null ? 0 : 1 + ((seed + index) % 3),
    last_at: value === null ? null : new Date(Math.min(NOW, last - 6 * HOUR)).toISOString(),
  };
}

/** Adds what `show`/`at`/`periods` ask for (`shown`, `history`), the way the backend does: totals add their teams up. */
export function withShown(board: Board, show: Snap, at: number, periods: number): Board {
  const starts = [periodStart(at, show)];
  while (starts.length < Math.max(1, periods)) starts.push(periodStart(starts[starts.length - 1] - 1, show));
  starts.reverse();
  const teamCells: Record<string, Record<string, ShownNumbers[]>> = {};
  for (const [teamId, inst] of Object.entries(board.instances)) {
    const seed = NUMBERS[teamId]?.seed ?? 1;
    for (const metric of board.metrics) {
      const series = starts.map((start, i) => shownCell(metric, seed, NUMBERS[teamId]?.revenue ?? 0, start, show, i, starts.length));
      (teamCells[teamId] ??= {})[metric.id] = series;
      const cell = inst.metrics[metric.id];
      if (!cell) continue;
      cell.shown = series[series.length - 1];
      if (periods) cell.history = series;
    }
  }
  const members: Record<string, string[]> = {
    org: Object.keys(board.instances),
    [SALES.id]: [SALES.id, NORTH.id, SOUTH.id],
  };
  for (const [key, tot] of Object.entries(board.totals)) {
    for (const metric of board.metrics) {
      const cell = tot.metrics[metric.id];
      if (!cell) continue;
      const series = starts.map((start, i) => {
        const cells = (members[key] ?? []).map((id) => teamCells[id]?.[metric.id]?.[i]).filter((c): c is ShownNumbers => !!c);
        const values = cells.map((c) => c.value).filter((v): v is number => v !== null);
        const quotas = cells.map((c) => c.quota).filter((q): q is number => q !== null);
        return {
          start: day(start),
          last: cells[0]?.last ?? day(start),
          value: values.length ? values.reduce((a, b) => a + b, 0) : null,
          quota: quotas.length ? quotas.reduce((a, b) => a + b, 0) : null,
          count: cells.reduce((a, c) => a + (c.count ?? 0), 0),
          last_at: cells.map((c) => c.last_at).filter(Boolean).sort().pop() ?? null,
        };
      });
      cell.shown = series[series.length - 1];
      if (periods) cell.history = series;
    }
  }
  return { ...board, show };
}

/** "Week of Oct 5" for the period around now - for story descriptions and checks. */
export const thisWeek = periodLabel(periodStart(NOW, "week"), "week");

/**
 * The board's API: the templates, Acme's teams, and the board itself
 * (`make` builds it; `show`/`at`/`periods` are honored).
 */
export function boardHandlers(make: () => Board = makeBoard): HttpHandler[] {
  return [
    http.get("*/api/v1/goal-templates", () =>
      HttpResponse.json({ items: templates, total: templates.length, page: 1, page_size: 100 }),
    ),
    http.get("*/api/v1/teams", () => HttpResponse.json({ items: orgTeams, total: orgTeams.length, page: 1, page_size: 100 })),
    http.get("*/api/v1/goal-templates/:id/board", async ({ params, request }) => {
      await delay(150);
      if (params.id === emptyTemplate.id) {
        return HttpResponse.json({ ...make(), template: { id: emptyTemplate.id, title: emptyTemplate.title, org_id: ORG }, goals: [], metrics: [] });
      }
      const url = new URL(request.url);
      const show = url.searchParams.get("show") as Snap | "" | null;
      const at = Date.parse(url.searchParams.get("at") ?? "") || NOW;
      const periods = Number(url.searchParams.get("periods") ?? 0);
      const board = make();
      return HttpResponse.json(show ? withShown(board, show, at, periods) : board);
    }),
    http.post("*/api/v1/goal-templates/:id/:action", () => HttpResponse.json({ goals: [], deleted: [], detached: [], total_for: ["org"] })),
  ];
}
