import { Fragment } from "react";
import { Checkbox, FormControl } from "platform-core";
import type { Board, BoardMetric, CellNumbers, ShownNumbers } from "../../api/teamBoard";
import { periodLabel, periodStart, type Snap } from "../../lib/periods";
import {
  ONE_PER_WORDS,
  PER_LABELS,
  fmt,
  heat,
  isNumber,
  onCellKey,
  paceLine,
  periodLine,
  periodSummary,
  shownLabel,
  shownPct,
  updateDate,
  updateTime,
  type EditTarget,
  type Mode,
} from "./boardHelpers";
import type { Column, Row } from "./boardRows";
import { ClockIcon } from "./boardIcons";
import type { BoardDrafts } from "./useBoardDrafts";

/** A cell in a shown period: its value (and target), then which period. */
function shownBlock(shown: ShownNumbers | null | undefined, numbers: CellNumbers, metric: BoardMetric, per: Snap) {
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

/** A team's own row with a total (ticked with sub-teams, or with members' copies): the total, as a line under its own numbers. */
function totalLine(row: Row, column: Column) {
  if (!row.withTotal) return null;
  const numbers = row.total?.metrics[column.metric.id];
  if (!numbers) return <span className="gn-sub gn-total-line">Total -</span>;
  const title = row.memberCount
    ? `The total of this team's own numbers${row.parent ? ", its members' and every team below it" : " and its members'"}`
    : "The total of this team and every team below it";
  return (
    <span className="gn-sub gn-total-line" title={title}>
      Total{" "}
      {numbers.target_per && numbers.target_value !== numbers.base_value
        ? periodLine(numbers)
        : `${fmt(numbers.current_value)} / ${fmt(numbers.target_value)}`}
      {numbers.progress !== null && ` · ${Math.round(numbers.progress)}%`}
    </span>
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
      {row.withTotal && row.total?.updated?.[goalId] && (
        <span className="gn-sub gn-total-line">
          {row.total.updated[goalId].updated}/{row.total.updated[goalId].teams} {row.memberCount ? "updated" : "teams"}
        </span>
      )}
    </td>
  );
}

export interface BoardTableProps {
  board: Board;
  /** The picked template (its page link). */
  templateId: string;
  rows: Row[];
  columns: Column[];
  mode: Mode;
  /** "Show by" period ("" = running totals). */
  show: Snap | "";
  /** Showing by a period: check-in mode with a period picked and the board's numbers for it. */
  showing: boolean;
  /** "Checked in at" (a `datetime-local` value). */
  when: string;
  busy: boolean;
  /** Targets mode, managers and team leads: each row's "Own" and "Total" ticks, as two columns. */
  picking: boolean;
  drafts: BoardDrafts;
  templateHref?: (templateId: string) => string;
  goalHref?: (goalId: string) => string;
  /** Own ticked: the team gets its copy of the template (a member's row: the member gets their own). */
  onJoin: (row: Row) => void;
  /** Own unticked: ask, then take the team (or member) out. */
  onLeave: (row: Row) => void;
  /** A total's tick ("org" or a team id). */
  onToggleTotal: (key: string, on: boolean) => void;
  /** A column header's goal or metric, to edit. */
  onEdit: (target: EditTarget) => void;
  /** A column header's "×": ask, then remove it from the template. */
  onRemove: (target: EditTarget & { name: string }) => void;
}

/**
 * The board's grid in Check in and Targets mode: teams (and totals) as
 * rows, the template's goals and metrics as columns, with each goal's
 * "Last update" after its metrics. Check in: an input per cell the caller
 * may check in on. Targets: each team's start and target, the planned
 * target on totals, and the managers' Own / Total ticks.
 */
function BoardTable({
  board,
  templateId,
  rows,
  columns,
  mode,
  show,
  showing,
  when,
  busy,
  picking,
  drafts,
  templateHref,
  goalHref,
  onJoin,
  onLeave,
  onToggleTotal,
  onEdit,
  onRemove,
}: BoardTableProps) {
  // One "Last update" column per goal; it's for the day of "Checked in at".
  const updateColumns = columns.filter((column) => column.last).length;
  const dayLabel = when ? new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(when)) : "today";

  function totalCell(row: Row, column: Column) {
    const numbers = row.total?.metrics[column.metric.id];
    if (!numbers) return <td key={column.metric.id} className="gn-cell gn-num">—</td>;
    const planned = numbers.planned_target;
    const draft = drafts.targets.get(numbers.id)?.planned_target;
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
              onChange={(e) => drafts.editTarget(numbers.id, "planned_target", e.target.value)}
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
    const value = drafts.values.get(numbers.id) ?? "";
    const { aggregation, one_per: onePer } = column.metric;
    // One reading per period: a sum check-in is the period's total so far and
    // replaces the earlier one. With the same period as the quota, the
    // earlier one is this period's value - so the new total is known.
    const replaces = aggregation === "sum" && !!onePer;
    const preview =
      !replaces ? (aggregation === "sum" ? numbers.current_value + Number(value) : Number(value))
      : onePer === numbers.target_per ? numbers.current_value - (numbers.period_value ?? 0) + Number(value)
      : null;
    const noteOpen = drafts.openNotes.has(numbers.id);
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
          onChange={(e) => drafts.setValue(numbers.id, e.target.value)}
          onKeyDown={onCellKey}
        />
        <button
          type="button"
          className="gn-icon-btn"
          title={noteOpen ? "Hide the note" : "Add a note"}
          aria-label={`Note, ${column.metric.name}, ${row.label}`}
          aria-pressed={noteOpen}
          onClick={() => drafts.toggleNote(numbers.id)}
        >
          ✎
        </button>
        {noteOpen && (
          <FormControl
            className="gn-note"
            placeholder="Note"
            aria-label={`Note for ${column.metric.name}, ${row.label}`}
            value={drafts.notes.get(numbers.id) ?? ""}
            onChange={(e) => drafts.setNote(numbers.id, e.target.value)}
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

  function instanceCell(row: Row, column: Column) {
    const instance = row.instance;
    const numbers = instance?.metrics[column.metric.id];
    if (!instance || !numbers) return <td key={column.metric.id} className="gn-cell">—</td>;
    const tracked = numbers.target_value === numbers.base_value;
    const due = numbers.check_in_due_at !== null && Date.parse(numbers.check_in_due_at) <= Date.now();
    const draft = drafts.targets.get(numbers.id);
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
              onChange={(e) => drafts.editTarget(numbers.id, "base_value", e.target.value)}
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
              onChange={(e) => drafts.editTarget(numbers.id, "target_value", e.target.value)}
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

  /** Targets mode: the "Own" and "Total" ticks of a row - a team's and the totals' for managers, a member's for the team's lead. */
  function pickCells(row: Row) {
    const owns = row.kind === "instance" ? !row.missing : row.kind === "total" ? false : null;
    const leaf = row.kind === "instance" && !row.parent;
    const allowed = row.person ? !!row.team?.can_assign : board.can_manage;
    return [
      <td key="own" className="gn-pick gn-pick-own">
        {owns === null ? (
          <span className="text-secondary" title="The whole organization is the sum of its teams">-</span>
        ) : (
          <Checkbox
            disabled={busy || !allowed}
            checked={owns}
            aria-label={row.person ? `${row.label} has their own targets` : `${row.label} has its own targets`}
            onChange={(checked) =>
              checked ? onJoin(row) : onLeave(row)
            }
          />
        )}
      </td>,
      <td key="total" className="gn-pick gn-pick-total">
        {row.person ? (
          <span className="text-secondary" title="Added into the team's total">-</span>
        ) : (
        <Checkbox
          disabled={busy || leaf || !!row.memberCount || !board.can_manage}
          checked={!!row.memberCount || (!leaf && !!row.ticked)}
          title={row.memberCount ? "Always added up: members have targets of their own" : leaf ? "No teams below to add up" : undefined}
          aria-label={`Add up ${row.kind === "org" ? "the whole organization" : row.label}`}
          onChange={(checked) => onToggleTotal(row.kind === "org" ? "org" : row.team!.id, checked)}
        />
        )}
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
            : board.can_manage
              ? "Not added up - tick Total to add up the teams below."
              : "Not added up."}
        </td>
      );
    }
    if (row.missing && row.person) {
      return (
        <td colSpan={span} className="text-secondary">
          Counts in the team's numbers - tick Own to give {row.label} targets of their own.
        </td>
      );
    }
    if (row.missing) {
      return (
        <td colSpan={span} className="text-secondary">
          {board.can_manage ? `Not in this template - tick Own to add ${row.label}.` : "Doesn't use this template in this cycle."}
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

  /** The small "×" after a header's name: remove that goal or metric from the template. */
  function removeButton(target: EditTarget, name: string) {
    const kind = target.endpoint === "/api/v1/template-metrics" ? "metric" : "goal";
    return (
      <button
        type="button"
        className="gn-head-remove"
        title={`Remove this ${kind} from the template`}
        aria-label={`Remove ${kind} ${name}`}
        onClick={() => onRemove({ ...target, name })}
      >
        ✕
      </button>
    );
  }

  return (
    <table className={`gn-board${picking ? " gn-picking" : ""}`}>
      <thead>
        <tr>
          <th className="gn-team" rowSpan={2}>
            Team
            {templateHref && (
              <a className="gn-sub" href={templateHref(templateId)}>Edit the template</a>
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
                    onClick={() => onEdit({ endpoint: "/api/v1/template-goals", id: column.metric.template_goal })}
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
                  onClick={() => onEdit({ endpoint: "/api/v1/template-metrics", id: column.metric.id })}
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
            className={`${row.kind === "org" || row.kind === "total" ? "gn-total" : ""}${row.kind === "group" ? " gn-group" : ""}${row.person ? " gn-member" : ""}${row.missing || ((row.kind === "org" || row.kind === "total") && !row.total) ? " gn-muted" : ""}`}
          >
            <th className="gn-team" style={{ paddingLeft: `${0.55 + row.depth * 1.1}rem` }}>
              {row.kind === "instance" && row.instance?.root && goalHref ? (
                <a href={goalHref(row.instance.root)}>{row.label}</a>
              ) : (
                row.label
              )}
              {(row.kind === "org" || row.kind === "total") && row.ticked && <span className="gn-sub">Total</span>}
              {row.person && (
                <span className="gn-sub">{row.missing ? (row.person.role === "lead" ? "Lead" : "Member") : "Own targets"}</span>
              )}
              {row.instance?.visibility === "team" && <span className="gn-sub">Team only</span>}
            </th>
            {picking && pickCells(row)}
            {rowCells(row)}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default BoardTable;
