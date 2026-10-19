import { Fragment, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  CrudDetailScreen,
  Drawer,
  FormControl,
  FormLabel,
  FormSelect,
  Modal,
  SegmentedControl,
  type LinkComponent,
} from "platform-core";
import TemplateWizard from "./TemplateWizard";
import PeriodPicker from "./PeriodPicker";
import { BOARD_CHART_CSS, BoardBarCharts, BoardLineCharts, type ChartPoint, type ChartSeries } from "./board/BoardCharts";
import { DASHBOARD_CSS } from "./dashboard/dashboardStyles";
import { fetchCycles, type Cycle } from "../lib/api/cycles";
import { fetchOrgs, fetchTeams, type OrgOption, type TeamOption } from "../lib/api/dashboard";
import { apiRequest } from "../lib/api/client";
import { errorMessage } from "../lib/api/goalMembers";
import {
  applyTemplate,
  leaveTemplate,
  setTemplateTotals,
  fetchBoard,
  fetchTemplates,
  saveCheckIns,
  saveTargets,
  type Board,
  type BoardInstance,
  type BoardMetric,
  type BoardTeam,
  type BoardTotal,
  type BoardMetric as BoardMetricRow,
  type CellNumbers,
  type ShownNumbers,
  type GoalTemplate,
  type TargetChange,
} from "../lib/api/teamBoard";
import { getCurrentOrg, PERSONAL_ORG, subscribeCurrentOrg } from "../lib/currentOrg";
import { readStored, writeStored } from "../lib/storedState";
import { midPeriod, nextPeriodStart, periodLabel, periodStart, SNAP_LABELS, type Snap } from "../lib/periods";

export interface TeamBoardScreenProps {
  accessToken: string;
  /** A template to open first (e.g. from `?template=` on the URL). */
  initialTemplateId?: string | null;
  /** Where a template's own page is - its goals and metrics are edited there. */
  templateHref?: (templateId: string) => string;
  /** Where a goal opens (a team's instance). */
  goalHref?: (goalId: string) => string;
  /** For links inside the edit drawer - same as `CrudDetailScreen`'s. */
  linkComponent?: LinkComponent;
  /** Where each resource's pages are mounted - same as `CrudDetailScreen`'s. */
  resourcePath?: (endpoint: string) => string | null;
}

/** A template goal or metric opened from a column header, to edit. */
interface EditTarget {
  endpoint: "/api/v1/template-goals" | "/api/v1/template-metrics";
  id: string;
}

type Mode = "checkin" | "targets" | "history";
const MODES: { value: Mode; label: string }[] = [
  { value: "checkin", label: "Check in" },
  { value: "targets", label: "Targets" },
  { value: "history", label: "Over time" },
];
/** Check in and Over time show the board as a table or as charts (remembered per browser). */
type View = "table" | "chart";
const VIEWS: { value: View; label: string }[] = [
  { value: "table", label: "Table" },
  { value: "chart", label: "Chart" },
];
const VIEW_KEY = "goalnexa:board-view";
/** "Over time": how many periods it shows, up to the picked day. */
const HISTORY_COUNT: Record<Snap, number> = { day: 14, week: 12, month: 12, quarter: 8, year: 5 };
/** The most periods Over time asks for (the API's cap). */
const MAX_HISTORY = 60;

/** The first day of the period `count` periods before the one starting at `start`. */
function periodsBack(start: number, per: Snap, count: number): number {
  let at = start;
  for (let i = 0; i < count; i += 1) at = periodStart(at - 1, per);
  return at;
}

/** How many periods from the one starting at `from` to the one at `to`, both in (stops past MAX_HISTORY). */
function periodsBetween(from: number, to: number, per: Snap): number {
  let count = 1;
  for (let at = from; at < to && count <= MAX_HISTORY; count += 1) at = nextPeriodStart(at, per);
  return count;
}
const NO_CYCLE = "none";
/** Org id -> the template last opened there. */
const TEMPLATE_KEY = "goalnexa:board-template";
/** The bottom of the app's sticky top bar(s) - where the board's header row stops when the page scrolls. */
function stickyTop(): number {
  let bottom = 0;
  for (const bar of document.querySelectorAll<HTMLElement>(".sticky-top")) {
    const rect = bar.getBoundingClientRect();
    // A bar across the top - not the desktop sidebar, which is sticky too.
    if (rect.height > 0 && rect.top <= 1 && rect.width >= window.innerWidth / 2) bottom = Math.max(bottom, rect.bottom);
  }
  return bottom;
}

/** The board's "Show by" period ("" = running totals), remembered per browser. */
const SHOW_KEY = "goalnexa:board-show";
const PICKERS_KEY = "goalnexa:board-pickers-folded";

const BOARD_CSS = `.gn-board-wrap { overflow-x: auto; }
.gn-history .gn-history-goal { font-weight: 600; }
.gn-history .gn-history-metric { font-weight: 400; }
.gn-history td.gn-num, .gn-history th.gn-num { text-align: right; }
.gn-history td.gn-period-edit { cursor: pointer; }
.gn-history td.gn-period-edit:hover, .gn-history td.gn-period-edit:focus-visible { box-shadow: inset 0 0 0 1px var(--tblr-primary, #066fd1); outline: none; }
.gn-history input.form-control { width: 6rem; text-align: right; }
.gn-period-tip { position: fixed; z-index: 1080; pointer-events: none; max-width: 280px; padding: .4rem .6rem; border-radius: 6px; font-size: .75rem; line-height: 1.45;
  background: var(--tblr-bg-surface, #fff); color: var(--tblr-body-color, #1d273b); border: 1px solid var(--tblr-border-color, #e6e7e9); box-shadow: 0 4px 16px rgba(0, 0, 0, .12); }
.gn-period-tip > div:first-child { font-weight: 600; }
.gn-period-tip > div:last-child:not(:first-child) { color: var(--tblr-secondary, #667382); }
.gn-fold-btn { display: inline-flex; align-items: center; gap: .4rem; max-width: 100%; min-width: 0; font-weight: 500; }
.gn-board-card:fullscreen { background: var(--tblr-body-bg, #f6f8fb); padding: 1rem; overflow: auto; }
.gn-board-card:fullscreen .gn-board-wrap { overflow: auto; max-height: calc(100vh - 6.5rem); }
.gn-board { border-collapse: separate; border-spacing: 0; font-size: .85rem; min-width: 100%; }
.gn-board th, .gn-board td { padding: .35rem .55rem; white-space: nowrap; border-bottom: 1px solid var(--tblr-border-color, #e6e7e9); background: var(--tblr-bg-surface, #fff); vertical-align: top; }
.gn-board thead th { position: sticky; z-index: 2; font-weight: 600; text-align: left; transform: translateY(var(--gn-head-y, 0px)); }
.gn-board thead tr:first-child th { top: 0; }
.gn-board thead tr:nth-child(2) th { top: 2.1rem; font-weight: 500; }
.gn-board .gn-team { position: sticky; left: 0; z-index: 1; width: 1px; box-shadow: inset -1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-board thead .gn-team { z-index: 3; }
.gn-board tr.gn-total > * { background: var(--tblr-bg-surface-secondary, #f6f8fb); font-weight: 600; }
.gn-board tr.gn-muted > * { color: var(--tblr-secondary, #667382); }
.gn-board tr.gn-group > * { background: var(--tblr-bg-surface-secondary, #f6f8fb); font-weight: 600; }
.gn-board .gn-pick { position: sticky; z-index: 1; width: 3rem; min-width: 3rem; max-width: 3rem; text-align: center; padding-left: .3rem; padding-right: .3rem; }
.gn-board .gn-total-line { margin-top: .3rem; padding-top: .2rem; border-top: 1px dashed var(--tblr-border-color, #e6e7e9); font-weight: 600; }
.gn-board .gn-pick-own { left: var(--gn-team-w, 0px); }
.gn-board .gn-pick-total { left: calc(var(--gn-team-w, 0px) + 3rem); box-shadow: inset -1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-board.gn-picking .gn-team { box-shadow: none; }
.gn-board thead .gn-pick { z-index: 3; }
.gn-board thead th.gn-pick { text-align: center; font-size: .75rem; vertical-align: bottom; }
.gn-board .gn-pick .form-check-input { margin: 0; float: none; }
.gn-board .gn-board-goal { border-left: 2px solid var(--tblr-border-color, #e6e7e9); }
.gn-board .gn-head-btn { all: unset; cursor: pointer; }
.gn-board .gn-head-remove { all: unset; cursor: pointer; margin-left: .3rem; color: var(--tblr-secondary, #667382); opacity: .45; font-size: .8rem; line-height: 1; }
.gn-board th:hover .gn-head-remove, .gn-board .gn-head-remove:focus-visible { opacity: 1; }
.gn-board .gn-head-remove:hover { color: var(--tblr-danger, #d63939); }
.gn-board .gn-head-btn:hover, .gn-board .gn-head-btn:focus-visible { color: var(--tblr-primary, #066fd1); text-decoration: underline; }
.gn-board .gn-num { font-variant-numeric: tabular-nums; }
.gn-board .gn-update { min-width: 6.5rem; }
.gn-board th.gn-update { color: var(--tblr-secondary, #667382); font-weight: 500; }
.gn-board td.gn-update { font-variant-numeric: tabular-nums; }
.gn-board .gn-sub { display: block; font-size: .7rem; color: var(--tblr-secondary, #667382); font-weight: 400; }
.gn-board .gn-gap-neg { color: var(--tblr-danger, #d63939); }
.gn-board td.gn-cell { min-width: 9rem; }
.gn-board input.form-control { width: 6.5rem; display: inline-block; }
.gn-board input.gn-dirty { border-color: var(--tblr-primary, #066fd1); box-shadow: 0 0 0 1px var(--tblr-primary, #066fd1); }
.gn-board .gn-note { width: 9rem !important; margin-top: .2rem; }
.gn-board .gn-h-done { background: color-mix(in srgb, var(--tblr-success, #2fb344) 16%, var(--tblr-bg-surface, #fff)); }
.gn-board .gn-h-good { background: color-mix(in srgb, var(--tblr-success, #2fb344) 7%, var(--tblr-bg-surface, #fff)); }
.gn-board .gn-h-mid { background: color-mix(in srgb, var(--tblr-warning, #f76707) 9%, var(--tblr-bg-surface, #fff)); }
.gn-board .gn-h-low { background: color-mix(in srgb, var(--tblr-danger, #d63939) 8%, var(--tblr-bg-surface, #fff)); }
.gn-board tr.gn-total .gn-h-done, .gn-board tr.gn-total .gn-h-good, .gn-board tr.gn-total .gn-h-mid, .gn-board tr.gn-total .gn-h-low { font-weight: 600; }
.gn-board .gn-badge { font-size: .65rem; font-weight: 500; margin-left: .35rem; }
@media (max-width: 576px) { .gn-board .gn-team { min-width: 8rem; max-width: 10rem; white-space: normal; } }
.gn-board .gn-icon-btn { border: 0; background: none; padding: 0 .2rem; color: var(--tblr-secondary, #667382); cursor: pointer; }
`;

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });
function fmt(value: number | null | undefined): string {
  return value === null || value === undefined ? "—" : numberFormat.format(value);
}

function heat(progress: number | null | undefined): string {
  if (progress === null || progress === undefined) return "";
  if (progress >= 100) return "gn-h-done";
  if (progress >= 70) return "gn-h-good";
  if (progress >= 40) return "gn-h-mid";
  return "gn-h-low";
}

/** "Week of Oct 6", for a shown period's first day ("YYYY-MM-DD"). */
function shownLabel(shown: ShownNumbers, per: Snap): string {
  const [year, month, day] = shown.start.split("-").map(Number);
  return periodLabel(new Date(year, month - 1, day).getTime(), per);
}

/** A shown cell's %: against the period's target, or - a reading with a target for the whole goal - from base to target. */
function shownPct(shown: ShownNumbers, numbers: CellNumbers, metric: BoardMetricRow): number | null {
  if (shown.value === null) return null;
  if (shown.quota) return (shown.value / shown.quota) * 100;
  if (metric.aggregation === "latest" && !numbers.target_per && numbers.target_value !== numbers.base_value) {
    return Math.max(0, ((shown.value - numbers.base_value) / (numbers.target_value - numbers.base_value)) * 100);
  }
  return null;
}

/** A cell in a shown period: its value (and target), then which period. */
function shownBlock(shown: ShownNumbers | null | undefined, numbers: CellNumbers, metric: BoardMetricRow, per: Snap) {
  if (!shown) return <>—<span className="gn-sub">not totalled</span></>;
  const target =
    shown.quota !== null ? shown.quota
    : metric.aggregation === "latest" && !numbers.target_per && numbers.target_value !== numbers.base_value ? numbers.target_value
    : null;
  const pct = shownPct(shown, numbers, metric);
  return (
    <>
      {shown.value === null ? "—" : fmt(shown.value)}
      {target !== null && <> / {fmt(target)}</>}
      <span className="gn-sub">
        {shown.value === null ? "no check-in · " : ""}
        {shownLabel(shown, per)}
        {pct !== null ? ` · ${Math.round(pct)}%` : ""}
      </span>
    </>
  );
}

/** "total today": the board's placeholder for a metric with one reading per period. */
const ONE_PER_WORDS: Record<string, string> = {
  day: "today",
  week: "this week",
  month: "this month",
  quarter: "this quarter",
  year: "this year",
};

const PER_LABELS: Record<string, string> = {
  day: "per day",
  week: "per week",
  month: "per month",
  quarter: "per quarter",
  year: "per year",
};

/** "Today 6/10" for a target per period, or why there's no target right now. */
function periodLine(numbers: CellNumbers): string | null {
  if (!numbers.target_per) return null;
  const pace = numbers.pace;
  if (!pace || pace.in_period === false) return "No target this period";
  const label = (pace.period_label ?? "").replace(/^./, (c) => c.toUpperCase());
  return `${label} ${fmt(pace.done)}/${fmt(pace.quota)}`;
}

/** Under a period line: the hit rate and streak, or the total against every period's target. */
function periodSummary(numbers: CellNumbers, progressBy: string): string {
  if (progressBy === "hit_rate") {
    const rate = numbers.hit_rate === null ? "—" : `${Math.round(numbers.hit_rate)}%`;
    const streak = numbers.streak ? ` · ${numbers.streak} in a row` : "";
    return `${rate} hit${streak}`;
  }
  return `Total ${fmt(numbers.current_value)}/${fmt(numbers.cumulative_target)}`;
}

/** A running total's pace: what's needed per day (or week) to land on target. */
function paceLine(numbers: CellNumbers): string | null {
  const pace = numbers.pace;
  if (!pace || numbers.target_per || pace.per_day === undefined) return null;
  return pace.per_week !== undefined ? `≈ ${fmt(pace.per_week)}/week to go` : `≈ ${fmt(pace.per_day)}/day to go`;
}

/** Now, as a `datetime-local` value (local time, minutes). */
/** `t` as a `datetime-local` value ("YYYY-MM-DDTHH:mm", local time). */
function localInput(t: number): string {
  const d = new Date(t);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowLocal(): string {
  return localInput(Date.now());
}

/** "Checked in at" for the period starting at `start`: now in the current one, else its middle (see `midPeriod`). */
function whenFor(start: number, per: Snap): string {
  return start === periodStart(Date.now(), per) ? nowLocal() : localInput(midPeriod(start, per));
}

const SNAP_RANK: Record<string, number> = { day: 0, week: 1, month: 2, quarter: 3, year: 4 };

/**
 * Whether an "Over time" cell can be set by one check-in: not when the
 * metric keeps one reading per a different period (the new one would
 * replace another), or snaps check-ins to a longer one (it would land
 * outside the cell).
 */
function periodEditable(metric: BoardMetric, per: Snap): boolean {
  if (metric.one_per && metric.one_per !== per && metric.aggregation === "sum") return false;
  return !metric.snap_to || SNAP_RANK[metric.snap_to] <= SNAP_RANK[per];
}

/** When a check-in that sets an "Over time" cell is made: now in the current period, else inside it - a reading at its end, so it's the period's last. */
function periodCheckInAt(cell: ShownNumbers, per: Snap, reading: boolean): string {
  const [y, m, d] = cell.start.split("-").map(Number);
  const start = new Date(y, m - 1, d).getTime();
  if (start === periodStart(Date.now(), per)) return new Date().toISOString();
  if (reading) {
    const [ly, lm, ld] = cell.last.split("-").map(Number);
    return new Date(ly, lm - 1, ld, 23, 59).toISOString();
  }
  return new Date(midPeriod(start, per)).toISOString();
}

const tipTime = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
const tipDay = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" });

function today(): string {
  return nowLocal().slice(0, 10);
}

/** The cycle running today, else the latest one not closed, else none. */
function defaultCycle(cycles: Cycle[]): string {
  const day = today();
  const running = cycles.find((c) => c.status !== "closed" && c.starts_on <= day && day <= c.ends_on);
  return (running ?? cycles.find((c) => c.status !== "closed"))?.id ?? NO_CYCLE;
}

const isNumber = (value: string) => value.trim() !== "" && Number.isFinite(Number(value));

interface Row {
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
interface BoardBlock {
  key: string;
  label: string;
  /** "Total" on a total. */
  sub?: string;
  depth: number;
  metrics: Record<string, CellNumbers>;
  /** A team's own copy the user may check in on. */
  canCheckIn?: boolean;
}

interface Column {
  metric: BoardMetric;
  goalTitle: string;
  /** First column of its goal - draws the group border. */
  first: boolean;
  /** Last metric column of its goal - the goal's "Last update" column follows it. */
  last: boolean;
}

const updateTime = new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" });
const updateDate = new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function goalOrder(board: Board): { id: string; title: string; depth: number }[] {
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
function buildRows(board: Board, root: string, mode: Mode): { rows: Row[]; notJoined: number } {
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


/** Down when the pickers are open, right when folded. */
const ChevronIcon = (open: boolean) => (
  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={open ? "M6 9l6 6l6 -6" : "M9 6l6 6l-6 6"} />
  </svg>
);

const ClockIcon = (
  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0" />
    <path d="M12 7v5l3 3" />
  </svg>
);

/**
 * The team board (docs/team-templates.md): one goal template, one cycle,
 * the org's team tree as rows and the template's goals/metrics as
 * columns. Check in mode: an input per cell the caller may check in on,
 * saved together (`POST check-ins/bulk`). Targets mode: each team's base
 * and target, the planned (top-down) target on totals with the gap to
 * what the teams committed, and - for the org's owners/admins - applying
 * the template to teams that don't have it yet. Totals rows are read-only
 * (the server adds the teams up).
 */
function TeamBoardScreen({
  accessToken,
  initialTemplateId,
  templateHref,
  goalHref,
  linkComponent,
  resourcePath,
}: TeamBoardScreenProps) {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  // Full screen: the board's card (grid and save bar) through the browser's Fullscreen API; Esc leaves.
  const boardRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === boardRef.current && boardRef.current !== null);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);
  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void boardRef.current?.requestFullscreen?.().catch(() => undefined);
  }
  // A template goal or metric to remove, waiting for "Remove" in the confirmation.
  const [removing, setRemoving] = useState<(EditTarget & { name: string }) | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  // A team row unticked in Targets mode, waiting for "Take out" in the confirmation.
  const [leaving, setLeaving] = useState<Row | null>(null);
  // The edit drawer and the confirmations open outside the card - leave full screen for them.
  useEffect(() => {
    if ((editing || removing || leaving) && document.fullscreenElement) void document.exitFullscreen();
  }, [editing, removing, leaving]);
  const [orgs, setOrgs] = useState<OrgOption[] | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [templateId, setTemplateId] = useState<string | null>(initialTemplateId ?? null);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [cycleId, setCycleId] = useState<string>(NO_CYCLE);
  const [board, setBoard] = useState<Board | null>(null);
  const [root, setRoot] = useState("");
  const [mode, setMode] = useState<Mode>("checkin");
  const [when, setWhen] = useState(nowLocal);
  // "Now" for the period pickers (render must not read the clock).
  const [openedAt] = useState(() => Date.now());
  const [show, setShowState] = useState<Snap | "">(() => readStored<Snap | "">(SHOW_KEY, ""));
  // The picker card folds to one summary line (remembered per browser).
  const [pickersFolded, setPickersFoldedState] = useState(() => readStored<boolean>(PICKERS_KEY, false));
  function setPickersFolded(value: boolean) {
    setPickersFoldedState(value);
    writeStored(PICKERS_KEY, value);
  }
  const [view, setViewState] = useState<View>(() => readStored<View>(VIEW_KEY, "table"));
  function setView(value: View) {
    setViewState(value);
    writeStored(VIEW_KEY, value);
    resetDrafts();
  }
  function setShow(value: Snap | "") {
    setShowState(value);
    writeStored(SHOW_KEY, value);
  }
  // The shown period follows "Checked in at"; only refetched while showing by a period.
  // The board's day ("Last update") and shown period both follow "Checked in at".
  const boardAt = when ? new Date(when).toISOString() : "";
  // "Over time": one column per period (Show by; a day when it's "Running totals").
  const historyPer: Snap | null = mode === "history" ? show || "day" : null;
  // Over time's range: From (a period's first day; null = the default count back) to `when`.
  const [historyFrom, setHistoryFrom] = useState<number | null>(null);
  const historyTo = historyPer ? periodStart(when ? new Date(when).getTime() : openedAt, historyPer) : 0;
  const historyStart = historyPer
    ? historyFrom !== null && periodStart(historyFrom, historyPer) <= historyTo
      ? periodStart(historyFrom, historyPer)
      : periodsBack(historyTo, historyPer, HISTORY_COUNT[historyPer] - 1)
    : 0;
  const historyCount = historyPer ? Math.min(MAX_HISTORY, periodsBetween(historyStart, historyTo, historyPer)) : 0;
  const charting = mode !== "targets" && view === "chart";
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Map<string, TargetChange>>(new Map());
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The template wizard: open for a new template, or to set up an empty one.
  // "Over time": the cell being typed into, and the hovered one's details (floating under it).
  const [periodEdit, setPeriodEdit] = useState<{ key: string; value: string } | null>(null);
  const [periodTip, setPeriodTip] = useState<{ left: number; top: number; lines: string[] } | null>(null);
  // Esc drops the typed number - the input's blur then mustn't save it.
  const periodCancel = useRef(false);
  const [wizard, setWizard] = useState<{ existing: GoalTemplate | null } | null>(null);
  const [orgTeams, setOrgTeams] = useState<TeamOption[]>([]);

  // "Over time" opens on the latest periods (the right end) - once per board
  // shown, so saving a cell (which reloads it) keeps the scroll where it was.
  const scrolledFor = useRef("");
  useEffect(() => {
    const wrap = wrapRef.current;
    const key = `${mode}:${board?.template.id}:${board?.cycle}:${historyPer}:${boardAt}:${view}`;
    // Not before the board with the periods is in (switching keeps the previous one meanwhile).
    const hasHistory = !!board && Object.values(board.instances).some((i) => Object.values(i.metrics).some((n) => n.history));
    if (!wrap || mode !== "history" || !hasHistory || scrolledFor.current === key) return;
    scrolledFor.current = key;
    wrap.scrollLeft = wrap.scrollWidth;
  }, [board, mode, historyPer, boardAt, view]);

  // Targets mode's tick columns stick next to the team column, whose width
  // follows its longest name - so their offset is measured (`--gn-team-w`).
  useEffect(() => {
    const wrap = wrapRef.current;
    const team = wrap?.querySelector<HTMLElement>("thead .gn-team");
    if (!wrap || !team) return;
    const observer = new ResizeObserver(() => wrap.style.setProperty("--gn-team-w", `${team.offsetWidth}px`));
    observer.observe(team);
    return () => observer.disconnect();
  }, [board, mode]);

  // The page scrolls, not the board (it only scrolls sideways, for many
  // columns) - and a sideways scroll box would pin a CSS-sticky header to
  // itself, not the page. So the header rows are moved down to just under
  // the app's top bar as the page scrolls (`--gn-head-y`). Full screen:
  // the board scrolls itself again and CSS sticky does it.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const table = wrap.querySelector("table");
      const head = wrap.querySelector("thead");
      let y = 0;
      if (table && head && !document.fullscreenElement) {
        const top = table.getBoundingClientRect().top;
        y = Math.min(Math.max(0, stickyTop() - top), table.offsetHeight - head.offsetHeight);
      }
      wrap.style.setProperty("--gn-head-y", `${Math.max(0, y)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule);
    schedule();
    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
    };
  }, [board, fullscreen]);

  // Orgs, and which one: the app-wide current org when it's a real org.
  useEffect(() => {
    let cancelled = false;
    fetchOrgs(accessToken)
      .then((rows) => {
        if (cancelled) return;
        setOrgs(rows);
        const current = getCurrentOrg();
        setOrgId(rows.find((o) => o.id === current)?.id ?? rows[0]?.id ?? null);
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    // The header's "Switch organization" picks it - the board has no org picker of its own.
    const unsubscribe = subscribeCurrentOrg(() => {
      const current = getCurrentOrg();
      if (current && current !== PERSONAL_ORG) {
        setOrgId(current);
        setRoot("");
      }
    });
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [accessToken]);

  // The org's templates and cycles.
  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    Promise.all([fetchTemplates(accessToken, orgId), fetchCycles(accessToken, orgId), fetchTeams(accessToken, orgId)])
      .then(([templateRows, cycleRows, teamRows]) => {
        if (cancelled) return;
        setTemplates(templateRows);
        setOrgTeams(teamRows);
        setCycles(cycleRows);
        setCycleId(defaultCycle(cycleRows));
        const remembered = readStored<Record<string, string>>(TEMPLATE_KEY, {})[orgId];
        setTemplateId((picked) => {
          const wanted = [picked, remembered].find((id) => id && templateRows.some((t) => t.id === id));
          return wanted ?? templateRows[0]?.id ?? null;
        });
      })
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, orgId]);

  // The board itself.
  useEffect(() => {
    if (!templateId || !templates.some((t) => t.id === templateId)) {
      setBoard(null);
      return;
    }
    let cancelled = false;
    fetchBoard(
      accessToken,
      templateId,
      cycleId === NO_CYCLE ? null : cycleId,
      historyPer ? { show: historyPer, at: boardAt, periods: historyCount } : { show, at: boardAt },
    )
      .then((data) => !cancelled && setBoard(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, templateId, cycleId, templates, version, show, boardAt, historyPer, historyCount]);

  const columns = useMemo<Column[]>(() => {
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
  }, [board]);
  // Targets mode, managers: each row's "Own" and "Total" ticks, as two columns.
  const picking = mode === "targets" && !!board?.can_manage;
  const { rows, notJoined } = useMemo(
    () => (board ? buildRows(board, root, mode) : { rows: [], notJoined: 0 }),
    [board, root, mode],
  );

  function resetDrafts() {
    setValues(new Map());
    setNotes(new Map());
    setOpenNotes(new Set());
    setTargets(new Map());
  }

  function pickTemplate(id: string) {
    setTemplateId(id);
    if (orgId) writeStored(TEMPLATE_KEY, { ...readStored<Record<string, string>>(TEMPLATE_KEY, {}), [orgId]: id });
    setRoot("");
    resetDrafts();
  }

  function editTarget(metricId: string, field: "base_value" | "target_value" | "planned_target", value: string) {
    setTargets((prev) => {
      const next = new Map(prev);
      next.set(metricId, { ...(next.get(metricId) ?? { metric: metricId }), [field]: value });
      return next;
    });
  }

  const dirtyCheckIns = [...values.entries()].filter(([, v]) => v.trim() !== "");
  const dirtyCount = mode === "checkin" ? dirtyCheckIns.length : targets.size;

  async function save() {
    if (!board) return;
    setError(null);
    setNotice(null);
    if (mode === "checkin") {
      const bad = dirtyCheckIns.find(([, v]) => !isNumber(v));
      if (bad) return setError("Every check-in needs a number.");
      const at = new Date(when).toISOString();
      setBusy(true);
      try {
        await saveCheckIns(
          accessToken,
          dirtyCheckIns.map(([metric, value]) => ({
            metric,
            value: value.trim(),
            note: notes.get(metric)?.trim() || undefined,
            checked_in_at: at,
          })),
        );
        setNotice(`Saved ${dirtyCheckIns.length} check-in${dirtyCheckIns.length === 1 ? "" : "s"}.`);
        resetDrafts();
        setVersion((v) => v + 1);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    const items: TargetChange[] = [];
    for (const change of targets.values()) {
      const item: TargetChange = { metric: change.metric };
      for (const field of ["base_value", "target_value"] as const) {
        const value = change[field];
        if (value === undefined) continue;
        if (!isNumber(value)) return setError("Base and target need numbers.");
        item[field] = value.trim();
      }
      if (change.planned_target !== undefined) {
        const value = change.planned_target ?? "";
        if (value.trim() !== "" && !isNumber(value)) return setError("A planned target needs a number - or leave it empty.");
        item.planned_target = value.trim() === "" ? null : value.trim();
      }
      items.push(item);
    }
    setBusy(true);
    try {
      await saveTargets(accessToken, board.template.id, items);
      setNotice("Targets saved.");
      resetDrafts();
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** Ticked in Targets mode: the team gets its copy of the template in this cycle. */
  async function join(row: Row) {
    if (!board || !row.team) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await applyTemplate(accessToken, board.template.id, [row.team.id], cycleId === NO_CYCLE ? null : cycleId);
      setNotice(`Added ${row.team.name} to the template. Set its targets in its row.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** Unticked, then confirmed: the team leaves the template in this cycle. */
  async function confirmLeave() {
    if (!board || !leaving?.team) return;
    const team = leaving.team;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await leaveTemplate(accessToken, board.template.id, [team.id], cycleId === NO_CYCLE ? null : cycleId);
      setNotice(
        result.detached.length
          ? `Took ${team.name} out of the template - its goals and check-ins stay, as ${team.name}'s own.`
          : `Took ${team.name} out of the template.`,
      );
      setLeaving(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** A total's tick: calculate it (from every team below) or not. */
  async function toggleTotal(key: string, on: boolean) {
    if (!board) return;
    const current = board.total_for ?? ["org"];
    const next = on ? [...current.filter((k) => k !== key), key] : current.filter((k) => k !== key);
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await setTemplateTotals(accessToken, board.template.id, next);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }


  /** Enter moves down the column, like a spreadsheet. */
  function onCellKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") return;
    event.preventDefault();
    const column = event.currentTarget.dataset.col;
    const inputs = [...document.querySelectorAll<HTMLInputElement>(`.gn-board input[data-col="${column}"]`)];
    const next = inputs[inputs.indexOf(event.currentTarget) + 1];
    next?.focus();
  }

  // One "Last update" column per goal; it's for the day of "Checked in at".
  const updateColumns = columns.filter((column) => column.last).length;
  const dayLabel = when ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(when)) : "today";

  // Showing by a period: check-in mode with a period picked and the board's numbers for it.
  const showing = mode === "checkin" && !!show && board?.show === show;

  function totalCell(row: Row, column: Column) {
    const numbers = row.total?.metrics[column.metric.id];
    if (!numbers) return <td key={column.metric.id} className="gn-cell gn-num">—</td>;
    const planned = numbers.planned_target;
    const draft = targets.get(numbers.id)?.planned_target;
    const editable = mode === "targets" && row.total?.can_plan && column.metric.rollup !== "min";
    const teams = numbers.teams_target;
    const gap = planned !== null && planned !== undefined && teams !== undefined ? teams - planned : null;
    if (showing) {
      const pct = numbers.shown ? shownPct(numbers.shown, numbers, column.metric) : null;
      return (
        <td key={column.metric.id} className={`gn-cell gn-num ${heat(pct)}`}>
          {shownBlock(numbers.shown, numbers, column.metric, show as Snap)}
        </td>
      );
    }
    return (
      <td key={column.metric.id} className={`gn-cell gn-num ${heat(numbers.progress)}`}>
        {numbers.target_per && numbers.target_value !== numbers.base_value ? (
          <>
            {periodLine(numbers)}
            <span className="gn-sub">{periodSummary(numbers, column.metric.progress_by)}</span>
          </>
        ) : (
          <>{fmt(numbers.current_value)} / {fmt(numbers.target_value)}</>
        )}
        {numbers.progress !== null && <span className="gn-sub">{Math.round(numbers.progress)}%</span>}
        {editable ? (
          <span className="gn-sub">
            Planned{" "}
            <FormControl
              className={draft !== undefined ? "gn-dirty" : undefined}
              inputMode="decimal"
              data-col={`${column.metric.id}-plan`}
              aria-label={`Planned target, ${column.metric.name}, ${row.label}`}
              value={draft ?? (planned === null || planned === undefined ? "" : String(planned))}
              placeholder={teams !== undefined ? fmt(teams) : ""}
              onChange={(e) => editTarget(numbers.id, "planned_target", e.target.value)}
              onKeyDown={onCellKey}
            />
          </span>
        ) : (
          planned !== null && planned !== undefined && <span className="gn-sub">⚑ planned {fmt(planned)}</span>
        )}
        {gap !== null && (
          <span className={`gn-sub${gap < 0 ? " gn-gap-neg" : ""}`}>
            teams {fmt(teams)} · gap {gap > 0 ? "+" : ""}{fmt(gap)}
          </span>
        )}
      </td>
    );
  }

  function checkInInput(numbers: CellNumbers, column: Column, row: Row) {
    const value = values.get(numbers.id) ?? "";
    const { aggregation, one_per: onePer } = column.metric;
    // One reading per period: a sum check-in is the period's total so far and
    // replaces the earlier one. With the same period as the quota, the
    // earlier one is this period's value - so the new total is known.
    const replaces = aggregation === "sum" && !!onePer;
    const preview =
      !replaces ? (aggregation === "sum" ? numbers.current_value + Number(value) : Number(value))
      : onePer === numbers.target_per ? numbers.current_value - (numbers.period_value ?? 0) + Number(value)
      : null;
    const noteOpen = openNotes.has(numbers.id);
    return (
      <>
        <FormControl
          className={value ? "gn-dirty" : undefined}
          inputMode="decimal"
          data-col={column.metric.id}
          aria-label={`${column.metric.name}, ${row.label}`}
          placeholder={replaces ? `total ${ONE_PER_WORDS[onePer]}` : aggregation === "sum" ? "+ amount" : "new value"}
          title={replaces ? `Replaces the earlier check-in ${ONE_PER_WORDS[onePer]}` : undefined}
          value={value}
          onChange={(e) => setValues((prev) => new Map(prev).set(numbers.id, e.target.value))}
          onKeyDown={onCellKey}
        />
        <button
          type="button"
          className="gn-icon-btn"
          title={noteOpen ? "Hide the note" : "Add a note"}
          aria-label={`Note, ${column.metric.name}, ${row.label}`}
          aria-pressed={noteOpen}
          onClick={() =>
            setOpenNotes((prev) => {
              const next = new Set(prev);
              if (next.has(numbers.id)) next.delete(numbers.id);
              else next.add(numbers.id);
              return next;
            })
          }
        >
          ✎
        </button>
        {noteOpen && (
          <FormControl
            className="gn-note"
            placeholder="Note"
            aria-label={`Note for ${column.metric.name}, ${row.label}`}
            value={notes.get(numbers.id) ?? ""}
            onChange={(e) => setNotes((prev) => new Map(prev).set(numbers.id, e.target.value))}
          />
        )}
        {value && isNumber(value) && preview !== null && <span className="gn-sub">→ {fmt(preview)}</span>}
        {column.metric.snap_to && when && (
          // Check-ins for a period: this one goes to the period around "Checked in at".
          <span className="gn-sub" title="Check-ins for this metric are for a whole period">
            for {periodLabel(periodStart(new Date(when).getTime(), column.metric.snap_to), column.metric.snap_to)}
          </span>
        )}
      </>
    );
  }

  /**
   * "Checked in at": a moment for running totals; with "Show by" a period,
   * that period instead (a day, or this/an earlier week, month, ...) - the
   * board shows it, and check-ins go to it.
   */
  function modeControl() {
    return (
      <SegmentedControl
        label="Mode"
        options={MODES}
        value={mode}
        onChange={(m) => {
          setMode(m);
          resetDrafts();
        }}
      />
    );
  }

  /**
   * "Over time": rows are teams (and totals) -> their goals -> metrics,
   * columns the periods up to the picked day; a cell is what was done in
   * that period (or its last reading), against its target per that period.
   */
  /** The board's teams and calculated totals, in row order, with their cells - for Over time and the charts. */
  function boardBlocks(): BoardBlock[] {
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
  function historyStarts(blocks: ReturnType<typeof boardBlocks>, per: Snap) {
    const sample = blocks.flatMap((b) => Object.values(b.metrics)).find((n) => n.history?.length && n.history.every(Boolean));
    const starts = sample?.history?.map((h) => h!.start) ?? [];
    const label = (start: string) => {
      const [y, m, d] = start.split("-").map(Number);
      return periodLabel(new Date(y, m - 1, d).getTime(), per);
    };
    return { starts, label };
  }

  /** A Check in cell as one number for its bar - the same number its table cell leads with. */
  function chartPoint(numbers: CellNumbers, metric: BoardMetric): ChartPoint {
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

  function boardCharts() {
    if (!board) return null;
    const blocks = boardBlocks();
    const series: ChartSeries[] = blocks.map((b) => ({ key: b.key, label: b.label, total: !!b.sub, metrics: b.metrics }));
    const goals = goalOrder(board);
    if (historyPer) {
      const { starts, label } = historyStarts(blocks, historyPer);
      return <BoardLineCharts goals={goals} metrics={board.metrics} series={series} starts={starts} label={label} />;
    }
    return <BoardBarCharts goals={goals} metrics={board.metrics} series={series} point={chartPoint} />;
  }

  /**
   * Sets an "Over time" cell to `typed`: a reading (or a one-per-period
   * total) is checked in as is; an amount, as the difference from what the
   * period has - its check-ins stay.
   */
  async function savePeriod(metric: BoardMetric, numbers: CellNumbers, cell: ShownNumbers, per: Snap, typed: string) {
    setPeriodEdit(null);
    const text = typed.trim();
    if (text === "" || (cell.value !== null && Number(text) === cell.value)) return;
    if (!isNumber(text)) return setError("A check-in needs a number.");
    const reading = metric.aggregation === "latest" || metric.one_per === per;
    const value = reading ? Number(text) : Number(text) - (cell.value ?? 0);
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await saveCheckIns(accessToken, [{ metric: numbers.id, value: String(value), checked_in_at: periodCheckInAt(cell, per, reading) }]);
      setNotice(reading ? `Saved ${fmt(value)}.` : `Checked in ${value > 0 ? "+" : ""}${fmt(value)}.`);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** The hover details of an "Over time" cell. */
  function periodTipLines(block: BoardBlock, metric: BoardMetric, cell: ShownNumbers | null, label: string, editable: boolean): string[] {
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

  function showPeriodTip(target: HTMLElement, lines: string[]) {
    const rect = target.getBoundingClientRect();
    setPeriodTip({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 280)), top: rect.bottom + 4, lines });
  }

  function historyTable(per: Snap) {
    if (!board) return null;
    const blocks = boardBlocks();
    const { starts, label } = historyStarts(blocks, per);
    const span = Math.max(starts.length, 1);
    const goals = goalOrder(board);
    const metricDepth = (metric: BoardMetric): number => {
      let depth = 0;
      let parent = metric.parent;
      while (parent) {
        depth += 1;
        parent = board.metrics.find((m) => m.id === parent)?.parent ?? null;
      }
      return depth;
    };
    return (
      <>
      <table className="gn-board gn-history">
        <thead>
          <tr>
            <th className="gn-team">Team · goal · metric</th>
            {starts.length ? starts.map((start) => <th key={start} className="gn-num">{label(start)}</th>) : <th>No check-ins in these periods.</th>}
          </tr>
        </thead>
        <tbody>
          {blocks.map((block) => (
            <Fragment key={block.key}>
              <tr className={block.sub ? "gn-total" : "gn-group"}>
                <th className="gn-team" style={{ paddingLeft: `${0.55 + block.depth * 1.1}rem` }}>
                  {block.label}
                  {block.sub && <span className="gn-sub">{block.sub}</span>}
                </th>
                <td colSpan={span}></td>
              </tr>
              {goals.map((goal) => {
                const metrics = board.metrics.filter((m) => m.template_goal === goal.id);
                if (metrics.length === 0) return null;
                return (
                  <Fragment key={goal.id}>
                    <tr>
                      <th className="gn-team gn-history-goal" style={{ paddingLeft: `${1.2 + (block.depth + goal.depth) * 1.1}rem` }}>
                        {goal.title}
                      </th>
                      <td colSpan={span}></td>
                    </tr>
                    {metrics.map((metric) => {
                      const numbers = block.metrics[metric.id];
                      return (
                        <tr key={metric.id}>
                          <th
                            className="gn-team gn-history-metric"
                            style={{ paddingLeft: `${2.3 + (block.depth + goal.depth + metricDepth(metric)) * 1.1}rem` }}
                          >
                            {metric.name}
                            {metric.unit && <span className="text-secondary"> ({metric.unit})</span>}
                          </th>
                          {starts.map((start, index) => {
                            const cell = numbers?.history?.[index] ?? null;
                            const pct = cell && numbers ? shownPct(cell, numbers, metric) : null;
                            const key = `${block.key}:${metric.id}:${index}`;
                            const editable = !!block.canCheckIn && !!numbers && !!cell && !busy && periodEditable(metric, per);
                            if (periodEdit?.key === key && numbers && cell) {
                              return (
                                <td key={start} className="gn-cell gn-num">
                                  <FormControl
                                    autoFocus
                                    inputMode="decimal"
                                    aria-label={`${metric.name}, ${block.label}, ${label(start)}`}
                                    value={periodEdit.value}
                                    onChange={(e) => setPeriodEdit({ key, value: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") e.currentTarget.blur();
                                      else if (e.key === "Escape") {
                                        periodCancel.current = true;
                                        setPeriodEdit(null);
                                      }
                                    }}
                                    onBlur={(e) => {
                                      if (periodCancel.current) periodCancel.current = false;
                                      else void savePeriod(metric, numbers, cell, per, e.currentTarget.value);
                                    }}
                                  />
                                </td>
                              );
                            }
                            const tip = () => periodTipLines(block, metric, cell, label(start), editable);
                            const startEdit = () => {
                              periodCancel.current = false;
                              setPeriodTip(null);
                              setPeriodEdit({ key, value: cell?.value === null || !cell ? "" : String(cell.value) });
                            };
                            return (
                              <td
                                key={start}
                                className={`gn-cell gn-num ${heat(pct)}${editable ? " gn-period-edit" : ""}`}
                                tabIndex={editable ? 0 : undefined}
                                onClick={editable ? startEdit : undefined}
                                onKeyDown={
                                  editable
                                    ? (e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          startEdit();
                                        }
                                      }
                                    : undefined
                                }
                                onMouseEnter={(e) => showPeriodTip(e.currentTarget, tip())}
                                onMouseLeave={() => setPeriodTip(null)}
                                onFocus={(e) => showPeriodTip(e.currentTarget, tip())}
                                onBlur={() => setPeriodTip(null)}
                              >
                                {cell?.value === null || cell === null ? "—" : fmt(cell.value)}
                                {cell?.quota !== null && cell?.quota !== undefined && (
                                  <span className="text-secondary"> / {fmt(cell.quota)}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </Fragment>
                );
              })}
            </Fragment>
          ))}
        </tbody>
      </table>
      {periodTip && (
        <div className="gn-period-tip" style={{ left: periodTip.left, top: periodTip.top }} role="tooltip">
          {periodTip.lines.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}
      </>
    );
  }


  /** Over time: the first and last period, picked by day/week/... (at most MAX_HISTORY periods). */
  function rangePicker(per: Snap) {
    const from = periodsBack(historyTo, per, historyCount - 1);
    const capped = historyFrom !== null && periodStart(historyFrom, per) < from;
    return (
      <>
        <FormLabel htmlFor="gn-board-when">Periods</FormLabel>
        <PeriodPicker
          id="gn-board-when"
          range
          per={per}
          onPerChange={(next) => {
            setHistoryFrom(null); // a new kind of period starts from its default span
            setShow(next);
          }}
          from={from}
          to={historyTo}
          onChange={(first, last) => {
            setHistoryFrom(first);
            setWhen(whenFor(last, per));
          }}
        />
        {capped && <div className="form-hint">Up to {MAX_HISTORY} at a time - the latest shown.</div>}
      </>
    );
  }

  function whenPicker() {
    if (historyPer) return rangePicker(historyPer);
    const per = show;
    if (!per) {
      return (
        <>
          <FormLabel htmlFor="gn-board-when">Checked in at</FormLabel>
          <FormControl id="gn-board-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </>
      );
    }
    const picked = periodStart(when ? new Date(when).getTime() : openedAt, per);
    return (
      <>
        <FormLabel htmlFor="gn-board-when">{SNAP_LABELS[per]}</FormLabel>
        <PeriodPicker
          id="gn-board-when"
          per={per}
          onPerChange={setShow}
          from={picked}
          to={picked}
          onChange={(_, last) => setWhen(whenFor(last, per))}
        />
      </>
    );
  }

  /** A team with sub-teams and its own copy: its ticked total, as a line under its own numbers. */
  function totalLine(row: Row, column: Column) {
    if (!row.parent || !row.ticked) return null;
    const numbers = row.total?.metrics[column.metric.id];
    if (!numbers) return <span className="gn-sub gn-total-line">Total -</span>;
    return (
      <span className="gn-sub gn-total-line" title="The total of this team and every team below it">
        Total{" "}
        {numbers.target_per && numbers.target_value !== numbers.base_value
          ? periodLine(numbers)
          : `${fmt(numbers.current_value)} / ${fmt(numbers.target_value)}`}
        {numbers.progress !== null && ` · ${Math.round(numbers.progress)}%`}
      </span>
    );
  }

  function instanceCell(row: Row, column: Column) {
    const instance = row.instance;
    const numbers = instance?.metrics[column.metric.id];
    if (!instance || !numbers) return <td key={column.metric.id} className="gn-cell">—</td>;
    const tracked = numbers.target_value === numbers.base_value;
    const due = numbers.check_in_due_at !== null && Date.parse(numbers.check_in_due_at) <= Date.now();
    const draft = targets.get(numbers.id);
    if (showing) {
      const pct = numbers.shown ? shownPct(numbers.shown, numbers, column.metric) : null;
      return (
        <td key={column.metric.id} className={`gn-cell gn-num ${heat(pct)}`}>
          {shownBlock(numbers.shown, numbers, column.metric, show as Snap)}
          {due && (
            <span className="text-warning ms-1" title="Check-in due">
              {ClockIcon}
            </span>
          )}
          {instance.can_check_in && checkInInput(numbers, column, row)}
          {totalLine(row, column)}
        </td>
      );
    }
    return (
      <td key={column.metric.id} className={`gn-cell gn-num ${mode === "checkin" ? heat(numbers.progress) : ""}`}>
        {mode === "targets" && instance.can_set_targets ? (
          <>
            <span className="gn-sub">Start</span>
            <FormControl
              className={draft?.base_value !== undefined ? "gn-dirty" : undefined}
              inputMode="decimal"
              data-col={`${column.metric.id}-base`}
              aria-label={`Start, ${column.metric.name}, ${row.label}`}
              value={draft?.base_value ?? String(numbers.base_value)}
              onChange={(e) => editTarget(numbers.id, "base_value", e.target.value)}
              onKeyDown={onCellKey}
            />
            <span className="gn-sub">Target{numbers.target_per ? ` ${PER_LABELS[numbers.target_per]}` : ""}</span>
            <FormControl
              className={draft?.target_value !== undefined ? "gn-dirty" : undefined}
              inputMode="decimal"
              data-col={`${column.metric.id}-target`}
              aria-label={`Target, ${column.metric.name}, ${row.label}`}
              value={draft?.target_value ?? (tracked ? "" : String(numbers.target_value))}
              placeholder="needs a target"
              onChange={(e) => editTarget(numbers.id, "target_value", e.target.value)}
              onKeyDown={onCellKey}
            />
          </>
        ) : (
          <>
            {tracked ? (
              <>
                {fmt(numbers.current_value)}
                <span className="badge bg-warning-lt gn-badge" title="No target yet - it doesn't count toward the totals">
                  needs target
                </span>
              </>
            ) : numbers.target_per ? (
              periodLine(numbers)
            ) : (
              <>{fmt(numbers.current_value)} / {fmt(numbers.target_value)}</>
            )}
            {due && (
              <span className="text-warning ms-1" title="Check-in due">
                {ClockIcon}
              </span>
            )}
            {!tracked && numbers.target_per && (
              <span className="gn-sub">{periodSummary(numbers, column.metric.progress_by)}</span>
            )}
            {numbers.progress !== null && <span className="gn-sub">{Math.round(numbers.progress)}%</span>}
            {paceLine(numbers) && <span className="gn-sub">{paceLine(numbers)}</span>}
            {mode === "checkin" && instance.can_check_in && checkInInput(numbers, column, row)}
          </>
        )}
        {totalLine(row, column)}
      </td>
    );
  }

  /**
   * After a goal's last metric: when the team last checked in on that goal on
   * the board's day ("Checked in at"), or - on a total - how many of its teams did.
   */
  function updateCell(row: Row, column: Column) {
    if (!column.last) return null;
    const goalId = column.metric.template_goal;
    const key = `${column.metric.id}-update`;
    if (row.kind !== "instance") {
      const counts = row.total?.updated?.[goalId];
      return (
        <td key={key} className="gn-cell gn-update">
          {counts && counts.teams > 0 ? `${counts.updated}/${counts.teams} teams` : "—"}
        </td>
      );
    }
    const update = row.instance?.last_update?.[goalId];
    return (
      <td key={key} className={`gn-cell gn-update${update && !update.on_day ? " text-secondary" : ""}`}>
        {update?.on_day ? updateTime.format(Date.parse(update.on_day)) : "—"}
        {update && !update.on_day && (
          <span className="gn-sub">{update.last ? `last ${updateDate.format(Date.parse(update.last))}` : "no check-ins yet"}</span>
        )}
        {row.parent && row.ticked && row.total?.updated?.[goalId] && (
          <span className="gn-sub gn-total-line">
            {row.total.updated[goalId].updated}/{row.total.updated[goalId].teams} teams
          </span>
        )}
      </td>
    );
  }

  /** Targets mode, managers: the "Own" and "Total" ticks of a row. */
  function pickCells(row: Row) {
    const owns = row.kind === "instance" ? !row.missing : row.kind === "total" ? false : null;
    const leaf = row.kind === "instance" && !row.parent;
    return [
      <td key="own" className="gn-pick gn-pick-own">
        {owns === null ? (
          <span className="text-secondary" title="The whole organization is the sum of its teams">-</span>
        ) : (
          <Checkbox
            disabled={busy}
            checked={owns}
            aria-label={`${row.label} has its own targets`}
            onChange={(checked) =>
              checked ? void join(row) : setLeaving(row)
            }
          />
        )}
      </td>,
      <td key="total" className="gn-pick gn-pick-total">
        <Checkbox
          disabled={busy || leaf}
          checked={!leaf && !!row.ticked}
          title={leaf ? "No teams below to add up" : undefined}
          aria-label={`Add up ${row.kind === "org" ? "the whole organization" : row.label}`}
          onChange={(checked) => void toggleTotal(row.kind === "org" ? "org" : row.team!.id, checked)}
        />
      </td>,
    ];
  }

  function rowCells(row: Row) {
    const span = Math.max(columns.length + updateColumns, 1);
    if (row.kind === "group") return <td colSpan={span}></td>;
    if (row.kind !== "instance") {
      if (row.total) return columns.flatMap((column) => [totalCell(row, column), updateCell(row, column)]);
      return (
        <td colSpan={span} className="text-secondary fw-normal">
          {row.ticked
            ? "Added up once a team below uses the template."
            : board?.can_manage
              ? "Not added up - tick Total to add up the teams below."
              : "Not added up."}
        </td>
      );
    }
    if (row.missing) {
      return (
        <td colSpan={span} className="text-secondary">
          {board?.can_manage ? `Not in this template - tick Own to add ${row.label}.` : "Doesn't use this template in this cycle."}
        </td>
      );
    }
    if (row.instance && !row.instance.visible) {
      return (
        <td colSpan={Math.max(columns.length + updateColumns, 1)} className="text-secondary">
          Only this team can see its numbers. They still count in the totals.
        </td>
      );
    }
    return columns.flatMap((column) => [instanceCell(row, column), updateCell(row, column)]);
  }

  const template = templates.find((t) => t.id === templateId) ?? null;
  const role = orgs?.find((o) => o.id === orgId)?.my_role;
  const canCreateTemplate = role === "owner" || role === "admin";

  async function confirmRemove() {
    if (!removing) return;
    setRemoveBusy(true);
    try {
      await apiRequest(`${removing.endpoint}/${removing.id}`, accessToken, { method: "DELETE" });
      setNotice(`Removed "${removing.name}" from the template.`);
      setRemoving(null);
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setRemoveBusy(false);
    }
  }

  /** The small "×" after a header's name: remove that goal or metric from the template. */
  function removeButton(target: EditTarget, name: string) {
    const kind = target.endpoint === "/api/v1/template-metrics" ? "metric" : "goal";
    return (
      <button
        type="button"
        className="gn-head-remove"
        title={`Remove this ${kind} from the template`}
        aria-label={`Remove ${kind} ${name}`}
        onClick={() => setRemoving({ ...target, name })}
      >
        ✕
      </button>
    );
  }

  function closeEditing() {
    setEditing(null);
    setVersion((v) => v + 1);
  }

  function wizardDone(templateId: string, created: GoalTemplate | null) {
    setWizard(null);
    if (created) setTemplates((prev) => [...prev, created].sort((a, b) => a.title.localeCompare(b.title)));
    pickTemplate(templateId);
    setVersion((v) => v + 1);
    setNotice(created ? `Created "${created.title}".` : "The template is set up.");
  }


  return (
    <div className="container-xl py-3">
      <style href="gn-team-board" precedence="default">
        {BOARD_CSS}
      </style>
      {charting && (
        <>
          <style href="goalnexa-dashboard" precedence="default">
            {DASHBOARD_CSS}
          </style>
          <style href="gn-board-charts" precedence="default">
            {BOARD_CHART_CSS}
          </style>
        </>
      )}
      <div className="d-flex flex-wrap align-items-end gap-3 mb-3">
        <div>
          <h2 className="page-title mb-1">Team board</h2>
          <div className="text-secondary small">One goal system, every team: check in, set targets, see the totals.</div>
        </div>
      </div>

      {orgs !== null && orgs.length === 0 && (
        <Card>
          <CardBody>Teams live in an organization - create one first, then its teams.</CardBody>
        </Card>
      )}

      {orgs !== null && orgs.length > 0 && (
        <Card className="mb-3">
          <CardBody className="py-2 d-flex align-items-center gap-2 flex-wrap">
            <button
              type="button"
              className="btn btn-ghost-secondary btn-sm gn-fold-btn"
              aria-expanded={!pickersFolded}
              aria-controls="gn-board-pickers"
              title={pickersFolded ? "Show the pickers" : "Hide the pickers"}
              onClick={() => setPickersFolded(!pickersFolded)}
            >
              {ChevronIcon(!pickersFolded)}
              Filters
            </button>
            <div className="ms-auto d-flex gap-2 flex-wrap">
              {mode !== "targets" && (
                <SegmentedControl label="View" variant="secondary" options={VIEWS} value={view} onChange={setView} />
              )}
              {modeControl()}
            </div>
          </CardBody>
          {!pickersFolded && (
          <CardBody className="border-top">
            <div id="gn-board-pickers" className="row g-2 align-items-start">
              <div className="col-sm-6 col-lg-3 position-relative">
                <FormLabel htmlFor="gn-board-template">Goal template</FormLabel>
                {canCreateTemplate && orgId && (
                    <Button
                      variant="link"
                      className="p-0 border-0 position-absolute top-0 end-0 me-1"
                      onClick={() => setWizard({ existing: null })}
                    >
                      + New
                    </Button>
                )}
                <FormSelect
                  id="gn-board-template"
                  value={templateId ?? ""}
                  onChange={(e) => pickTemplate(e.target.value)}
                  disabled={templates.length === 0}
                >
                  {templates.length === 0 && <option value="">No templates yet</option>}
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>{t.title}</option>
                  ))}
                </FormSelect>
              </div>
              <div className="col-sm-6 col-lg-2">
                <FormLabel htmlFor="gn-board-cycle">Cycle</FormLabel>
                <FormSelect
                  id="gn-board-cycle"
                  value={cycleId}
                  onChange={(e) => {
                    setCycleId(e.target.value);
                    resetDrafts();
                  }}
                >
                  {cycles.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}{c.status === "closed" ? " (closed)" : ""}</option>
                  ))}
                  <option value={NO_CYCLE}>No cycle</option>
                </FormSelect>
              </div>
              <div className="col-sm-6 col-lg-2">
                <FormLabel htmlFor="gn-board-root">Teams</FormLabel>
                <FormSelect id="gn-board-root" value={root} onChange={(e) => setRoot(e.target.value)}>
                  <option value="">All teams</option>
                  {(board?.teams ?? [])
                    .slice()
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                </FormSelect>
              </div>
              {mode !== "targets" && (
                <div className="col-sm-6 col-lg-3">{whenPicker()}</div>
              )}
              {mode === "checkin" && (
                <div className="col-sm-6 col-lg-2">
                  <FormLabel htmlFor="gn-board-show">Show by</FormLabel>
                  <FormSelect
                    id="gn-board-show"
                    value={show}
                    onChange={(e) => setShow(e.target.value as Snap | "")}
                  >
                    {mode === "checkin" && <option value="">Running totals</option>}
                    {(Object.keys(SNAP_LABELS) as Snap[]).map((per) => (
                      <option key={per} value={per}>{SNAP_LABELS[per]}</option>
                    ))}
                  </FormSelect>
                </div>
              )}
            </div>
          </CardBody>
          )}
        </Card>
      )}

      {wizard && orgId && (
        <TemplateWizard
          key={wizard.existing?.id ?? "new"}
          accessToken={accessToken}
          orgId={orgId}
          existing={wizard.existing}
          teams={orgTeams}
          cycles={cycles}
          cycleId={cycleId === NO_CYCLE ? null : cycleId}
          onDone={wizardDone}
          onClose={() => setWizard(null)}
        />
      )}
      {error && <div className="alert alert-danger" role="alert">{error}</div>}
      {notice && <div className="alert alert-success" role="status">{notice}</div>}

      {orgs !== null && orgs.length > 0 && templates.length === 0 && (
        <Card>
          <CardBody>
            No goal templates in this organization yet.{" "}
            {canCreateTemplate ? (
              <Button
                variant="link"
                className="p-0 align-baseline"
                onClick={() => setWizard({ existing: null })}
              >
                Create the first one
              </Button>
            ) : (
              "An owner or admin of the organization creates them."
            )}
          </CardBody>
        </Card>
      )}

      {board && template && (
        <div ref={boardRef} className="gn-board-card">
        <Card>
          <CardBody className="p-0">
            {board.teams.length === 0 ? (
              <div className="p-3">
                This organization has no teams yet - create them under Organizations → Teams, then add this template to
                them here (Targets).
              </div>
            ) : columns.length === 0 ? (
              <div className="p-4 text-center">
                <p className="mb-3">
                  {board.goals.length === 0 ? "This template has no goals or metrics yet." : "This template has no metrics yet."}
                </p>
                {canCreateTemplate && board.goals.length === 0 ? (
                  <Button variant="primary" onClick={() => setWizard({ existing: template })}>Set it up</Button>
                ) : (
                  templateHref && <a href={templateHref(template.id)}>Add them on the template's page</a>
                )}
              </div>
            ) : (
              <>
              {mode === "checkin" && notJoined > 0 && (
                <div className="px-3 py-2 small text-secondary border-bottom">
                  {notJoined} team{notJoined === 1 ? " doesn't" : "s don't"} use this template in this cycle.{" "}
                  {board.can_manage ? (
                    <Button variant="link" className="p-0 align-baseline small" onClick={() => { setMode("targets"); resetDrafts(); }}>
                      Add them in Targets
                    </Button>
                  ) : (
                    "An owner or admin adds teams in Targets."
                  )}
                </div>
              )}
              {charting ? (
                <div className="gn-charts gn-viz">{boardCharts()}</div>
              ) : (
              <div ref={wrapRef} className="gn-board-wrap" onScroll={periodTip ? () => setPeriodTip(null) : undefined}>
                {historyPer ? historyTable(historyPer) : (
                <table className={`gn-board${picking ? " gn-picking" : ""}`}>
                  <thead>
                    <tr>
                      <th className="gn-team" rowSpan={2}>
                        Team
                        {templateHref && (
                          <a className="gn-sub" href={templateHref(template.id)}>Edit the template</a>
                        )}
                      </th>
                      {picking && (
                        <>
                          <th className="gn-pick gn-pick-own" rowSpan={2} title="The team runs the template: it has its own targets and check-ins">
                            Own
                          </th>
                          <th className="gn-pick gn-pick-total" rowSpan={2} title="Add up the teams below into a total">
                            Total
                          </th>
                        </>
                      )}
                      {columns.map((column) =>
                        column.first ? (
                          <th
                            key={column.metric.id}
                            className="gn-board-goal"
                            colSpan={columns.filter((c) => c.metric.template_goal === column.metric.template_goal).length + 1}
                          >
                            {board.can_manage ? (
                              <button
                                type="button"
                                className="gn-head-btn"
                                title="Edit this goal of the template"
                                onClick={() => setEditing({ endpoint: "/api/v1/template-goals", id: column.metric.template_goal })}
                              >
                                {column.goalTitle}
                              </button>
                            ) : (
                              column.goalTitle
                            )}
                            {board.can_manage &&
                              removeButton({ endpoint: "/api/v1/template-goals", id: column.metric.template_goal }, column.goalTitle.replace(/^(› )+/, ""))}
                          </th>
                        ) : null,
                      )}
                    </tr>
                    <tr>
                      {columns.map((column) => (
                        <Fragment key={column.metric.id}>
                        <th className={column.first ? "gn-board-goal" : ""}>
                          {board.can_manage ? (
                            <button
                              type="button"
                              className="gn-head-btn"
                              title="Edit this metric of the template"
                              onClick={() => setEditing({ endpoint: "/api/v1/template-metrics", id: column.metric.id })}
                            >
                              {column.metric.name}
                            </button>
                          ) : (
                            column.metric.name
                          )}
                          {column.metric.unit && <span className="text-secondary"> ({column.metric.unit})</span>}
                          {board.can_manage && removeButton({ endpoint: "/api/v1/template-metrics", id: column.metric.id }, column.metric.name)}
                          <span className="gn-sub">
                            {column.metric.target_per ? `${PER_LABELS[column.metric.target_per]}${column.metric.count_days === "weekdays" ? " (weekdays)" : ""} · ` : ""}
                            {column.metric.rollup === "none" ? "not totalled" : `total: ${column.metric.rollup}`}
                          </span>
                        </th>
                        {column.last && (
                          <th className="gn-update">
                            Last update
                            <span className="gn-sub">on {dayLabel}</span>
                          </th>
                        )}
                        </Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.key}
                        className={`${row.kind === "org" || row.kind === "total" ? "gn-total" : ""}${row.kind === "group" ? " gn-group" : ""}${row.missing || ((row.kind === "org" || row.kind === "total") && !row.total) ? " gn-muted" : ""}`}
                      >
                        <th className="gn-team" style={{ paddingLeft: `${0.55 + row.depth * 1.1}rem` }}>
                          {row.kind === "instance" && row.instance?.root && goalHref ? (
                            <a href={goalHref(row.instance.root)}>{row.label}</a>
                          ) : (
                            row.label
                          )}
                          {(row.kind === "org" || row.kind === "total") && row.ticked && <span className="gn-sub">Total</span>}
                          {row.instance?.visibility === "team" && <span className="gn-sub">Team only</span>}
                        </th>
                        {picking && pickCells(row)}
                        {rowCells(row)}
                      </tr>
                    ))}
                  </tbody>
                </table>
                )}
              </div>
              )}
              </>
            )}
          </CardBody>
          <div className="card-footer d-flex flex-wrap gap-2 align-items-center">
            <Button variant="secondary" outline onClick={toggleFullscreen} aria-pressed={fullscreen}
              title={fullscreen ? "Leave full screen (Esc)" : "Show the board on the whole screen"}>
              {fullscreen ? "Exit full screen" : "⛶ Full screen"}
            </Button>
            {mode !== "history" && !charting && (<>
            <span className="text-secondary small ms-auto">
              {dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount === 1 ? "" : "s"}` : "Totals are calculated from the teams."}
            </span>
            {dirtyCount > 0 && (
              <Button variant="link" onClick={resetDrafts} disabled={busy}>Discard</Button>
            )}
            <Button variant="primary" onClick={() => void save()} disabled={busy || dirtyCount === 0}>
              {mode === "checkin"
                ? `Save ${dirtyCount || ""} check-in${dirtyCount === 1 ? "" : "s"}`
                : "Save targets"}
            </Button>
            </>)}
          </div>
        </Card>
        </div>
      )}
      <Modal
        open={leaving !== null}
        onClose={() => !busy && setLeaving(null)}
        size="sm"
        title={leaving?.team ? `Take ${leaving.team.name} out of the template?` : ""}
        footer={
          <>
            <Button variant="secondary" outline onClick={() => setLeaving(null)} disabled={busy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmLeave()} disabled={busy}>
              Take out
            </Button>
          </>
        }
      >
        {leaving?.team && (
          <p className="mb-0">
            {Object.values(leaving.instance?.metrics ?? {}).some((m) => m.last_checked_in_at)
              ? `${leaving.team.name} has check-ins: its goals and their history stay, as ${leaving.team.name}'s own goals, no longer part of the template.`
              : `${leaving.team.name}'s copy of the template and its targets are deleted.`}{" "}
            The totals above it stop counting it. Tick it again to start a fresh copy.
          </p>
        )}
      </Modal>
      <Modal
        open={removing !== null}
        onClose={() => !removeBusy && setRemoving(null)}
        size="sm"
        title={removing ? `Remove "${removing.name}"?` : ""}
        footer={
          <>
            <Button variant="secondary" outline onClick={() => setRemoving(null)} disabled={removeBusy}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmRemove()} disabled={removeBusy}>
              Remove
            </Button>
          </>
        }
      >
        {removing && (
          <p className="mb-0">
            {removing.endpoint === "/api/v1/template-metrics"
              ? "The metric and its sub-metrics leave the template and every team's copy, and the totals drop it."
              : "The goal, its sub-goals and their metrics leave the template and every team's copy, and the totals drop them."}{" "}
            A team's copy that already has check-ins is kept as that team's own, no longer part of the template.
          </p>
        )}
      </Modal>
      {/* A column header's goal or metric, edited in place; the board reloads on close (every team's copy follows). */}
      <Drawer
        open={editing !== null}
        title={editing?.endpoint === "/api/v1/template-metrics" ? "Template metric" : "Template goal"}
        onClose={closeEditing}
      >
        {editing && (
          <CrudDetailScreen
            key={`${editing.endpoint}/${editing.id}`}
            baseUrl={editing.endpoint}
            accessToken={accessToken}
            id={editing.id}
            linkComponent={linkComponent}
            resourcePath={resourcePath}
            onDeleted={closeEditing}
          />
        )}
      </Drawer>
    </div>
  );
}

export default TeamBoardScreen;
