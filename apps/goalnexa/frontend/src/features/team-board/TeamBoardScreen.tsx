import { useEffect, useMemo, useRef, useState } from "react";
import { Button, Card, CardBody, CrudDetailScreen, Drawer, type LinkComponent } from "platform-core";
import TemplateWizard from "./TemplateWizard";
import BoardPickers, { MomentPicker, RangePicker, ShowPicker } from "./BoardPickers";
import BoardTable from "./BoardTable";
import HistoryTable, { type PeriodTip } from "./HistoryTable";
import { LeaveTemplateModal, RemoveFromTemplateModal } from "./BoardModals";
import { BOARD_CSS } from "./boardStyles";
import {
  HISTORY_COUNT,
  MAX_HISTORY,
  NO_CYCLE,
  PICKERS_KEY,
  SHOW_KEY,
  TEMPLATE_KEY,
  VIEW_KEY,
  defaultCycle,
  fmt,
  isNumber,
  nowLocal,
  periodCheckInAt,
  periodsBack,
  periodsBetween,
  whenFor,
  type EditTarget,
  type Mode,
  type View,
} from "./boardHelpers";
import { boardBlocks, buildColumns, buildRows, chartPoint, goalOrder, historyStarts, type Row } from "./boardRows";
import { useBoardDrafts } from "./useBoardDrafts";
import { useBoardLayout, useFullscreen } from "./useBoardLayout";
import { BOARD_CHART_CSS, BoardBarCharts, BoardLineCharts, type ChartSeries } from "../../components/charts/BoardCharts";
import { DASHBOARD_CSS } from "../../components/dashboardStyles";
import { fetchCycles, type Cycle } from "../../api/cycles";
import { fetchOrgs, fetchTeams, type OrgOption, type TeamOption } from "../../api/dashboard";
import { apiRequest } from "../../api/client";
import { errorMessage } from "../../api/goalMembers";
import {
  applyTemplate,
  leaveTemplate,
  setTemplateTotals,
  fetchBoard,
  fetchTemplates,
  saveCheckIns,
  saveTargets,
  type Board,
  type BoardMetric,
  type CellNumbers,
  type ShownNumbers,
  type GoalTemplate,
  type TargetChange,
} from "../../api/teamBoard";
import { getCurrentOrg, PERSONAL_ORG, subscribeCurrentOrg } from "../../lib/currentOrg";
import { readStored, writeStored } from "../../lib/storedState";
import { periodStart, type Snap } from "../../lib/periods";

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
  const [fullscreen, toggleFullscreen] = useFullscreen(boardRef);
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
    drafts.reset();
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
  // The first period Over time shows (where the range picker's From is).
  const historyFirst = historyPer ? periodsBack(historyTo, historyPer, historyCount - 1) : 0;
  const charting = mode !== "targets" && view === "chart";
  // Typed and not saved yet: check-ins, notes, targets.
  const drafts = useBoardDrafts();
  const [version, setVersion] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // "Over time": the hovered cell's details (floating under it; the cell being typed into is HistoryTable's).
  const [periodTip, setPeriodTip] = useState<PeriodTip | null>(null);
  // The template wizard: open for a new template, or to set up an empty one.
  const [wizard, setWizard] = useState<{ existing: GoalTemplate | null } | null>(null);
  const [orgTeams, setOrgTeams] = useState<TeamOption[]>([]);

  useBoardLayout(wrapRef, { board, mode, historyPer, boardAt, view, fullscreen });

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

  const columns = useMemo(() => buildColumns(board), [board]);
  // Targets mode, managers: each row's "Own" and "Total" ticks, as two columns.
  const picking = mode === "targets" && !!board?.can_manage;
  const { rows, notJoined } = useMemo(
    () => (board ? buildRows(board, root, mode) : { rows: [], notJoined: 0 }),
    [board, root, mode],
  );

  function pickTemplate(id: string) {
    setTemplateId(id);
    if (orgId) writeStored(TEMPLATE_KEY, { ...readStored<Record<string, string>>(TEMPLATE_KEY, {}), [orgId]: id });
    setRoot("");
    drafts.reset();
  }

  const dirtyCheckIns = [...drafts.values.entries()].filter(([, v]) => v.trim() !== "");
  const dirtyCount = mode === "checkin" ? dirtyCheckIns.length : drafts.targets.size;

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
            note: drafts.notes.get(metric)?.trim() || undefined,
            checked_in_at: at,
          })),
        );
        setNotice(`Saved ${dirtyCheckIns.length} check-in${dirtyCheckIns.length === 1 ? "" : "s"}.`);
        drafts.reset();
        setVersion((v) => v + 1);
      } catch (e) {
        setError(errorMessage(e));
      } finally {
        setBusy(false);
      }
      return;
    }
    const items: TargetChange[] = [];
    for (const change of drafts.targets.values()) {
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
      drafts.reset();
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

  // Showing by a period: check-in mode with a period picked and the board's numbers for it.
  const showing = mode === "checkin" && !!show && board?.show === show;

  function boardCharts() {
    if (!board) return null;
    const blocks = boardBlocks(rows);
    const series: ChartSeries[] = blocks.map((b) => ({ key: b.key, label: b.label, total: !!b.sub, metrics: b.metrics }));
    const goals = goalOrder(board);
    if (historyPer) {
      const { starts, label } = historyStarts(blocks, historyPer);
      return <BoardLineCharts goals={goals} metrics={board.metrics} series={series} starts={starts} label={label} />;
    }
    return <BoardBarCharts goals={goals} metrics={board.metrics} series={series} point={(numbers, metric) => chartPoint(numbers, metric, showing)} />;
  }

  /**
   * Sets an "Over time" cell to `typed`: a reading (or a one-per-period
   * total) is checked in as is; an amount, as the difference from what the
   * period has - its check-ins stay.
   */
  async function savePeriod(metric: BoardMetric, numbers: CellNumbers, cell: ShownNumbers, per: Snap, typed: string) {
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
        <BoardPickers
          mode={mode}
          onModeChange={(m) => {
            setMode(m);
            drafts.reset();
          }}
          view={view}
          onViewChange={setView}
          pickersFolded={pickersFolded}
          onFoldedChange={setPickersFolded}
          templates={templates}
          templateId={templateId}
          onTemplateChange={pickTemplate}
          onNewTemplate={canCreateTemplate && orgId ? () => setWizard({ existing: null }) : undefined}
          cycles={cycles}
          cycleId={cycleId}
          onCycleChange={(id) => {
            setCycleId(id);
            drafts.reset();
          }}
          root={root}
          onRootChange={setRoot}
          teams={(board?.teams ?? []).slice().sort((a, b) => a.name.localeCompare(b.name))}
        >
          {mode === "history" && historyPer && (
            <div className="col-sm-6 col-lg-3">
              <RangePicker
                per={historyPer}
                from={historyFirst}
                to={historyTo}
                capped={historyFrom !== null && periodStart(historyFrom, historyPer) < historyFirst}
                onPerChange={(next) => {
                  setHistoryFrom(null); // a new kind of period starts from its default span
                  setShow(next);
                }}
                onChange={(first, last) => {
                  setHistoryFrom(first);
                  setWhen(whenFor(last, historyPer));
                }}
              />
            </div>
          )}
          {mode === "checkin" && (
            <div className="col-sm-6 col-lg-2">
              <ShowPicker
                show={show}
                picked={periodStart(when ? new Date(when).getTime() : openedAt, show || "week")}
                onShowChange={setShow}
                onPick={(last, per) => {
                  if (!show) setShow(per);
                  setWhen(whenFor(last, per));
                }}
              />
            </div>
          )}
          {mode === "checkin" && !show && (
            <div className="col-sm-6 col-lg-3">
              <MomentPicker when={when} onChange={setWhen} />
            </div>
          )}
        </BoardPickers>
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
                    <Button variant="link" className="p-0 align-baseline small" onClick={() => { setMode("targets"); drafts.reset(); }}>
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
                {historyPer ? (
                  <HistoryTable
                    board={board}
                    blocks={boardBlocks(rows)}
                    per={historyPer}
                    busy={busy}
                    tip={periodTip}
                    onTip={setPeriodTip}
                    onSavePeriod={(metric, numbers, cell, per, typed) => void savePeriod(metric, numbers, cell, per, typed)}
                  />
                ) : (
                  <BoardTable
                    board={board}
                    templateId={template.id}
                    rows={rows}
                    columns={columns}
                    mode={mode}
                    show={show}
                    showing={showing}
                    when={when}
                    busy={busy}
                    picking={picking}
                    drafts={drafts}
                    templateHref={templateHref}
                    goalHref={goalHref}
                    onJoin={(row) => void join(row)}
                    onLeave={setLeaving}
                    onToggleTotal={(key, on) => void toggleTotal(key, on)}
                    onEdit={setEditing}
                    onRemove={setRemoving}
                  />
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
              <Button variant="link" onClick={drafts.reset} disabled={busy}>Discard</Button>
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
      <LeaveTemplateModal leaving={leaving} busy={busy} onCancel={() => setLeaving(null)} onConfirm={() => void confirmLeave()} />
      <RemoveFromTemplateModal removing={removing} busy={removeBusy} onCancel={() => setRemoving(null)} onConfirm={() => void confirmRemove()} />
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
