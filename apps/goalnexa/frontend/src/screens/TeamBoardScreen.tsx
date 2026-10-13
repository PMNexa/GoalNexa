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
import { fetchCycles, type Cycle } from "../lib/api/cycles";
import { fetchOrgs, fetchTeams, type OrgOption, type TeamOption } from "../lib/api/dashboard";
import { apiRequest } from "../lib/api/client";
import { errorMessage } from "../lib/api/goalMembers";
import {
  applyTemplate,
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
import { getCurrentOrg, PERSONAL_ORG, setCurrentOrg, subscribeCurrentOrg } from "../lib/currentOrg";
import { readStored, writeStored } from "../lib/storedState";
import { midPeriod, periodLabel, periodStart, recentPeriods, SNAP_LABELS, type Snap } from "../lib/periods";

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

type Mode = "checkin" | "targets";
const MODES: { value: Mode; label: string }[] = [
  { value: "checkin", label: "Check in" },
  { value: "targets", label: "Targets" },
];
const NO_CYCLE = "none";
/** Org id -> the template last opened there. */
const TEMPLATE_KEY = "goalnexa:board-template";
/** The board's "Show by" period ("" = running totals), remembered per browser. */
const SHOW_KEY = "goalnexa:board-show";

const BOARD_CSS = `.gn-board-wrap { overflow: auto; max-height: calc(100vh - 16rem); }
.gn-board-card:fullscreen { background: var(--tblr-body-bg, #f6f8fb); padding: 1rem; overflow: auto; }
.gn-board-card:fullscreen .gn-board-wrap { max-height: calc(100vh - 6.5rem); }
.gn-board { border-collapse: separate; border-spacing: 0; font-size: .85rem; min-width: 100%; }
.gn-board th, .gn-board td { padding: .35rem .55rem; white-space: nowrap; border-bottom: 1px solid var(--tblr-border-color, #e6e7e9); background: var(--tblr-bg-surface, #fff); vertical-align: top; }
.gn-board thead th { position: sticky; z-index: 2; font-weight: 600; text-align: left; }
.gn-board thead tr:first-child th { top: 0; }
.gn-board thead tr:nth-child(2) th { top: 2.1rem; font-weight: 500; }
.gn-board .gn-team { position: sticky; left: 0; z-index: 1; min-width: 14rem; max-width: 20rem; box-shadow: inset -1px 0 0 var(--tblr-border-color, #e6e7e9); }
.gn-board thead .gn-team { z-index: 3; }
.gn-board tr.gn-total > * { background: var(--tblr-bg-surface-secondary, #f6f8fb); font-weight: 600; }
.gn-board tr.gn-muted > * { color: var(--tblr-secondary, #667382); }
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
  kind: "org" | "total" | "instance";
  label: string;
  depth: number;
  team?: BoardTeam;
  total?: BoardTotal;
  instance?: BoardInstance;
  /** A team with no instance yet - can be ticked to apply the template. */
  missing?: boolean;
  own?: boolean;
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

function buildRows(board: Board, root: string, mode: Mode): Row[] {
  const children = new Map<string | null, BoardTeam[]>();
  const known = new Set(board.teams.map((t) => t.id));
  for (const team of board.teams) {
    const key = team.parent && known.has(team.parent) ? team.parent : null;
    children.set(key, [...(children.get(key) ?? []), team]);
  }
  for (const list of children.values()) list.sort((a, b) => a.name.localeCompare(b.name));
  const rows: Row[] = [];
  if (!root) rows.push({ key: "org", kind: "org", label: "Whole organization", depth: 0, total: board.totals.org });
  const showMissing = mode === "targets" && board.can_manage;
  const visit = (team: BoardTeam, depth: number) => {
    const kids = children.get(team.id) ?? [];
    const instance = board.instances[team.id];
    if (kids.length > 0) {
      rows.push({ key: `total-${team.id}`, kind: "total", label: team.name, depth, team, total: board.totals[team.id] });
      if (instance || showMissing) {
        rows.push({
          key: `own-${team.id}`, kind: "instance", label: `${team.name} (own)`, depth: depth + 1, team, instance,
          missing: !instance, own: true,
        });
      }
      for (const kid of kids) visit(kid, depth + 1);
    } else {
      rows.push({ key: `team-${team.id}`, kind: "instance", label: team.name, depth, team, instance, missing: !instance });
    }
  };
  const start = root ? board.teams.filter((t) => t.id === root) : children.get(null) ?? [];
  for (const team of start) visit(team, root ? 0 : 1);
  return rows;
}

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
  // The edit drawer and the remove confirmation open outside the card - leave full screen for them.
  useEffect(() => {
    if ((editing || removing) && document.fullscreenElement) void document.exitFullscreen();
  }, [editing, removing]);
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
  function setShow(value: Snap | "") {
    setShowState(value);
    writeStored(SHOW_KEY, value);
  }
  // The shown period follows "Checked in at"; only refetched while showing by a period.
  // The board's day ("Last update") and shown period both follow "Checked in at".
  const boardAt = when ? new Date(when).toISOString() : "";
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [notes, setNotes] = useState<Map<string, string>>(new Map());
  const [openNotes, setOpenNotes] = useState<Set<string>>(new Set());
  const [targets, setTargets] = useState<Map<string, TargetChange>>(new Map());
  const [applyTeams, setApplyTeams] = useState<Set<string>>(new Set());
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // The template wizard: open for a new template, or to set up an empty one.
  const [wizard, setWizard] = useState<{ existing: GoalTemplate | null } | null>(null);
  const [orgTeams, setOrgTeams] = useState<TeamOption[]>([]);

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
    const unsubscribe = subscribeCurrentOrg(() => {
      const current = getCurrentOrg();
      if (current && current !== PERSONAL_ORG) setOrgId(current);
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
    fetchBoard(accessToken, templateId, cycleId === NO_CYCLE ? null : cycleId, { show, at: boardAt })
      .then((data) => !cancelled && setBoard(data))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [accessToken, templateId, cycleId, templates, version, show, boardAt]);

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
  const rows = useMemo(() => (board ? buildRows(board, root, mode) : []), [board, root, mode]);

  function resetDrafts() {
    setValues(new Map());
    setNotes(new Map());
    setOpenNotes(new Set());
    setTargets(new Map());
    setApplyTeams(new Set());
  }

  function pickOrg(id: string) {
    setOrgId(id);
    setCurrentOrg(id);
    setRoot("");
    resetDrafts();
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

  async function apply() {
    if (!board || applyTeams.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      await applyTemplate(accessToken, board.template.id, [...applyTeams], cycleId === NO_CYCLE ? null : cycleId);
      setNotice(`Added the template to ${applyTeams.size} team${applyTeams.size === 1 ? "" : "s"}. Set their targets below.`);
      setApplyTeams(new Set());
      setVersion((v) => v + 1);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  /** One team, from its row's "Add" (Check in mode). */
  async function addTeam(teamId: string, label: string) {
    if (!board) return;
    setBusy(true);
    setError(null);
    try {
      await applyTemplate(accessToken, board.template.id, [teamId], cycleId === NO_CYCLE ? null : cycleId);
      setNotice(`Added the template to ${label}. Set its targets in Targets.`);
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
  function whenPicker() {
    if (!show) {
      return (
        <>
          <FormLabel htmlFor="gn-board-when">Checked in at</FormLabel>
          <FormControl id="gn-board-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
        </>
      );
    }
    const picked = periodStart(when ? new Date(when).getTime() : openedAt, show);
    if (show === "day") {
      return (
        <>
          <FormLabel htmlFor="gn-board-when">Day</FormLabel>
          <FormControl id="gn-board-when" type="date" value={localInput(picked).slice(0, 10)} max={today()}
            onChange={(e) => e.target.value && setWhen(whenFor(new Date(`${e.target.value}T00:00`).getTime(), "day"))} />
        </>
      );
    }
    const periods = recentPeriods(show, openedAt);
    if (!periods.some((p) => p.start === picked)) periods.push({ start: picked, label: periodLabel(picked, show) });
    return (
      <>
        <FormLabel htmlFor="gn-board-when">{SNAP_LABELS[show]}</FormLabel>
        <FormSelect id="gn-board-when" value={String(picked)} onChange={(e) => setWhen(whenFor(Number(e.target.value), show))}>
          {periods.map((p, index) => (
            <option key={p.start} value={p.start}>{index === 0 ? `This ${show} (${p.label})` : p.label}</option>
          ))}
        </FormSelect>
      </>
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
      </td>
    );
  }

  function rowCells(row: Row) {
    if (row.kind !== "instance") return columns.flatMap((column) => [totalCell(row, column), updateCell(row, column)]);
    if (row.missing) {
      return (
        <td colSpan={Math.max(columns.length + updateColumns, 1)} className="text-secondary">
          {mode === "targets" && board?.can_manage && row.team ? (
            <label className="form-check mb-0">
              <Checkbox
                checked={applyTeams.has(row.team.id)}
                onChange={(checked) =>
                  setApplyTeams((prev) => {
                    const next = new Set(prev);
                    if (checked) next.add(row.team!.id);
                    else next.delete(row.team!.id);
                    return next;
                  })
                }
              />
              <span className="form-check-label">Not set up - tick to add this template to {row.label}</span>
            </label>
          ) : board?.can_manage && row.team ? (
            <>
              Doesn't use this template in this cycle.{" "}
              <Button variant="primary" outline className="ms-2" disabled={busy}
                onClick={() => void addTeam(row.team!.id, row.label)}>
                Add
              </Button>
            </>
          ) : (
            "Doesn't use this template in this cycle."
          )}
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
          <CardBody>
            <div className="row g-2 align-items-start">
              {orgs.length > 1 && (
                <div className="col-sm-6 col-lg-2">
                  <FormLabel htmlFor="gn-board-org">Organization</FormLabel>
                  <FormSelect id="gn-board-org" value={orgId ?? ""} onChange={(e) => pickOrg(e.target.value)}>
                    {orgs.map((org) => (
                      <option key={org.id} value={org.id}>{org.name}</option>
                    ))}
                  </FormSelect>
                </div>
              )}
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
              {mode === "checkin" && (
                <div className="col-sm-6 col-lg-3">{whenPicker()}</div>
              )}
              {mode === "checkin" && (
                <div className="col-sm-6 col-lg-2">
                  <FormLabel htmlFor="gn-board-show">Show by</FormLabel>
                  <FormSelect id="gn-board-show" value={show} onChange={(e) => setShow(e.target.value as Snap | "")}>
                    <option value="">Running totals</option>
                    {(Object.keys(SNAP_LABELS) as Snap[]).map((per) => (
                      <option key={per} value={per}>{SNAP_LABELS[per]}</option>
                    ))}
                  </FormSelect>
                </div>
              )}
              <div className="col-auto ms-auto align-self-end">
                <SegmentedControl
                  label="Mode"
                  options={MODES}
                  value={mode}
                  onChange={(m) => {
                    setMode(m);
                    resetDrafts();
                  }}
                />
              </div>
            </div>
          </CardBody>
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
              <div className="gn-board-wrap">
                <table className="gn-board">
                  <thead>
                    <tr>
                      <th className="gn-team" rowSpan={2}>
                        Team
                        {templateHref && (
                          <a className="gn-sub" href={templateHref(template.id)}>Edit the template</a>
                        )}
                      </th>
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
                        className={`${row.kind !== "instance" ? "gn-total" : ""}${row.missing ? " gn-muted" : ""}`}
                      >
                        <th className="gn-team" style={{ paddingLeft: `${0.55 + row.depth * 1.1}rem` }}>
                          {row.kind === "instance" && row.instance?.root && goalHref ? (
                            <a href={goalHref(row.instance.root)}>{row.label}</a>
                          ) : (
                            row.label
                          )}
                          {row.kind !== "instance" && <span className="gn-sub">Total</span>}
                          {row.instance?.visibility === "team" && <span className="gn-sub">Team only</span>}
                        </th>
                        {rowCells(row)}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
          <div className="card-footer d-flex flex-wrap gap-2 align-items-center">
            <Button variant="secondary" outline onClick={toggleFullscreen} aria-pressed={fullscreen}
              title={fullscreen ? "Leave full screen (Esc)" : "Show the board on the whole screen"}>
              {fullscreen ? "Exit full screen" : "⛶ Full screen"}
            </Button>
            {mode === "targets" && board.can_manage && (
              <Button variant="primary" outline onClick={() => void apply()} disabled={busy || applyTeams.size === 0}>
                Add to {applyTeams.size || ""} team{applyTeams.size === 1 ? "" : "s"}
              </Button>
            )}
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
          </div>
        </Card>
        </div>
      )}
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
