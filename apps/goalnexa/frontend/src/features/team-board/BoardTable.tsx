import { Fragment } from "react";
import { Checkbox, FormControl, formatDate, useLocale, useT } from "platform-core";
import type { Board, BoardMetric, CellNumbers, ShownNumbers } from "../../api/teamBoard";
import { momentLabel, momentStart, type Snap } from "../../lib/periods";
import {
  fmt,
  heat,
  isNumber,
  onCellKey,
  onePerWords,
  paceLine,
  perLabel,
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
import messages, { type BoardT } from "./messages";

/** A cell in a shown period: its value (and target), then which period. */
function shownBlock(t: BoardT, shown: ShownNumbers | null | undefined, numbers: CellNumbers, metric: BoardMetric, per: Snap) {
  if (!shown) return <>—<span className="gn-sub">{t("notTotalled")}</span></>;
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
        {shown.value === null ? t("noCheckInSep") : ""}
        {shownLabel(shown, per)}
        {pct !== null ? ` · ${Math.round(pct)}%` : ""}
      </span>
    </>
  );
}

/** A team's own row with a total (ticked with sub-teams, or with members' copies): the total, as a line under its own numbers. */
function totalLine(t: BoardT, row: Row, column: Column) {
  if (!row.withTotal) return null;
  const numbers = row.total?.metrics[column.metric.id];
  if (!numbers) return <span className="gn-sub gn-total-line">{t("totalDash")}</span>;
  const title = row.memberCount
    ? t(row.parent ? "totalTitleMembersParent" : "totalTitleMembers")
    : t("totalTitleTeams");
  return (
    <span className="gn-sub gn-total-line" title={title}>
      {t("total")}{" "}
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
function updateCell(t: BoardT, row: Row, column: Column) {
  if (!column.last) return null;
  const goalId = column.metric.template_goal;
  const key = `${column.metric.id}-update`;
  if (row.kind !== "instance") {
    const counts = row.total?.updated?.[goalId];
    return (
      <td key={key} className="gn-cell gn-update">
        {counts && counts.teams > 0 ? t("teamsUpdated", { updated: counts.updated, teams: counts.teams }) : "—"}
      </td>
    );
  }
  const update = row.instance?.last_update?.[goalId];
  return (
    <td key={key} className={`gn-cell gn-update${update && !update.on_day ? " text-secondary" : ""}`}>
      {update?.on_day ? updateTime(Date.parse(update.on_day)) : "—"}
      {update && !update.on_day && (
        <span className="gn-sub">{update.last ? t("lastAt", { date: updateDate(Date.parse(update.last)) }) : t("noCheckInsYet")}</span>
      )}
      {row.withTotal && row.total?.updated?.[goalId] && (
        <span className="gn-sub gn-total-line">
          {t(row.memberCount ? "updatedCount" : "teamsUpdated", { updated: row.total.updated[goalId].updated, teams: row.total.updated[goalId].teams })}
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
  const t = useT(messages);
  const locale = useLocale();
  // One "Last update" column per goal; it's for the day of "Checked in at".
  const updateColumns = columns.filter((column) => column.last).length;
  const dayLabel = when ? formatDate(new Date(when), { month: "short", day: "numeric" }, locale) : t("today");

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
          {shownBlock(t, numbers.shown, numbers, column.metric, show as Snap)}
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
            {t("planned")}{" "}
            <FormControl
              className={draft !== undefined ? "gn-dirty" : undefined}
              inputMode="decimal"
              data-col={`${column.metric.id}-plan`}
              aria-label={t("plannedAria", { metric: column.metric.name, row: row.label })}
              value={draft ?? (planned === null || planned === undefined ? "" : String(planned))}
              placeholder={teams !== undefined ? fmt(teams) : ""}
              onChange={(e) => drafts.editTarget(numbers.id, "planned_target", e.target.value)}
              onKeyDown={onCellKey}
            />
          </span>
        ) : (
          planned !== null && planned !== undefined && <span className="gn-sub">{t("plannedValue", { value: fmt(planned) })}</span>
        )}
        {gap !== null && (
          <span className={`gn-sub${gap < 0 ? " gn-gap-neg" : ""}`}>
            {t("teamsGap", { teams: fmt(teams), gap: `${gap > 0 ? "+" : ""}${fmt(gap)}` })}
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
          placeholder={replaces ? t("totalWhen", { when: onePerWords(onePer) }) : aggregation === "sum" ? t("plusAmount") : t("newValue")}
          title={replaces ? t("replacesTitle", { when: onePerWords(onePer) }) : undefined}
          value={value}
          onChange={(e) => drafts.setValue(numbers.id, e.target.value)}
          onKeyDown={onCellKey}
        />
        <button
          type="button"
          className="gn-icon-btn"
          title={noteOpen ? t("hideNote") : t("addNote")}
          aria-label={t("noteAria", { metric: column.metric.name, row: row.label })}
          aria-pressed={noteOpen}
          onClick={() => drafts.toggleNote(numbers.id)}
        >
          ✎
        </button>
        {noteOpen && (
          <FormControl
            className="gn-note"
            placeholder={t("note")}
            aria-label={t("noteForAria", { metric: column.metric.name, row: row.label })}
            value={drafts.notes.get(numbers.id) ?? ""}
            onChange={(e) => drafts.setNote(numbers.id, e.target.value)}
          />
        )}
        {value && isNumber(value) && preview !== null && <span className="gn-sub">→ {fmt(preview)}</span>}
        {column.metric.snap_to && when && (
          // A frequency: this one goes to the metric's period running at "Checked in at" (opened by the moment before it).
          <span className="gn-sub" title={t("snapHint")}>
            {t("forPeriod", { period: momentLabel(momentStart(new Date(when).getTime(), column.metric.snap_to, column.metric), column.metric.snap_to) })}
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
          {shownBlock(t, numbers.shown, numbers, column.metric, show as Snap)}
          {due && (
            <span className="text-warning ms-1" title={t("checkInDue")}>
              {ClockIcon}
            </span>
          )}
          {instance.can_check_in && checkInInput(numbers, column, row)}
          {totalLine(t, row, column)}
        </td>
      );
    }
    return (
      <td key={column.metric.id} className={`gn-cell gn-num ${mode === "checkin" ? heat(numbers.progress) : ""}`}>
        {mode === "targets" && instance.can_set_targets ? (
          <>
            <span className="gn-sub">{t("start")}</span>
            <FormControl
              className={draft?.base_value !== undefined ? "gn-dirty" : undefined}
              inputMode="decimal"
              data-col={`${column.metric.id}-base`}
              aria-label={t("startAria", { metric: column.metric.name, row: row.label })}
              value={draft?.base_value ?? String(numbers.base_value)}
              onChange={(e) => drafts.editTarget(numbers.id, "base_value", e.target.value)}
              onKeyDown={onCellKey}
            />
            <span className="gn-sub">{numbers.target_per ? t("targetPer", { per: perLabel(numbers.target_per) }) : t("target")}</span>
            <FormControl
              className={draft?.target_value !== undefined ? "gn-dirty" : undefined}
              inputMode="decimal"
              data-col={`${column.metric.id}-target`}
              aria-label={t("targetAria", { metric: column.metric.name, row: row.label })}
              value={draft?.target_value ?? (tracked ? "" : String(numbers.target_value))}
              placeholder={t("needsTargetPlaceholder")}
              onChange={(e) => drafts.editTarget(numbers.id, "target_value", e.target.value)}
              onKeyDown={onCellKey}
            />
          </>
        ) : (
          <>
            {tracked ? (
              <>
                {fmt(numbers.current_value)}
                <span className="badge bg-warning-lt gn-badge" title={t("needsTargetTitle")}>
                  {t("needsTarget")}
                </span>
              </>
            ) : numbers.target_per ? (
              periodLine(numbers)
            ) : (
              <>{fmt(numbers.current_value)} / {fmt(numbers.target_value)}</>
            )}
            {due && (
              <span className="text-warning ms-1" title={t("checkInDue")}>
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
        {totalLine(t, row, column)}
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
          <span className="text-secondary" title={t("orgSumTitle")}>-</span>
        ) : (
          <Checkbox
            disabled={busy || !allowed}
            checked={owns}
            aria-label={t(row.person ? "ownAriaPerson" : "ownAriaTeam", { name: row.label })}
            onChange={(checked) =>
              checked ? onJoin(row) : onLeave(row)
            }
          />
        )}
      </td>,
      <td key="total" className="gn-pick gn-pick-total">
        {row.person ? (
          <span className="text-secondary" title={t("addedIntoTeam")}>-</span>
        ) : (
        <Checkbox
          disabled={busy || leaf || !!row.memberCount || !board.can_manage}
          checked={!!row.memberCount || (!leaf && !!row.ticked)}
          title={row.memberCount ? t("alwaysAddedUp") : leaf ? t("noTeamsBelow") : undefined}
          aria-label={t("addUpAria", { name: row.kind === "org" ? t("wholeOrgLower") : row.label })}
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
      if (row.total) return columns.flatMap((column) => [totalCell(row, column), updateCell(t, row, column)]);
      return (
        <td colSpan={span} className="text-secondary fw-normal">
          {row.ticked ? t("addedUpOnce") : board.can_manage ? t("notAddedUpTick") : t("notAddedUp")}
        </td>
      );
    }
    if (row.missing && row.person) {
      return (
        <td colSpan={span} className="text-secondary">
          {t("memberMissing", { name: row.label })}
        </td>
      );
    }
    if (row.missing) {
      return (
        <td colSpan={span} className="text-secondary">
          {board.can_manage ? t("teamMissingManage", { name: row.label }) : t("teamMissing")}
        </td>
      );
    }
    if (row.instance && !row.instance.visible) {
      return (
        <td colSpan={Math.max(columns.length + updateColumns, 1)} className="text-secondary">
          {t("hiddenTeam")}
        </td>
      );
    }
    return columns.flatMap((column) => [instanceCell(row, column), updateCell(t, row, column)]);
  }

  /** The small "×" after a header's name: remove that goal or metric from the template. */
  function removeButton(target: EditTarget, name: string) {
    const metric = target.endpoint === "/api/v1/template-metrics";
    return (
      <button
        type="button"
        className="gn-head-remove"
        title={t(metric ? "removeMetricTitle" : "removeGoalTitle")}
        aria-label={t(metric ? "removeMetricAria" : "removeGoalAria", { name })}
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
            {t("team")}
            {templateHref && (
              <a className="gn-sub" href={templateHref(templateId)}>{t("editTemplate")}</a>
            )}
          </th>
          {picking && (
            <>
              <th className="gn-pick gn-pick-own" rowSpan={2} title={t("ownHeadTitle")}>
                {t("own")}
              </th>
              <th className="gn-pick gn-pick-total" rowSpan={2} title={t("totalHeadTitle")}>
                {t("total")}
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
                    title={t("editGoalTitle")}
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
                  title={t("editMetricTitle")}
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
                {column.metric.target_per ? `${perLabel(column.metric.target_per)}${column.metric.count_days === "weekdays" ? t("weekdays") : ""} · ` : ""}
                {column.metric.rollup === "none" ? t("notTotalled") : t(`rollup_${column.metric.rollup}`)}
              </span>
            </th>
            {column.last && (
              <th className="gn-update">
                {t("lastUpdate")}
                <span className="gn-sub">{t("onDay", { day: dayLabel })}</span>
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
              {(row.kind === "org" || row.kind === "total") && row.ticked && <span className="gn-sub">{t("total")}</span>}
              {row.person && (
                <span className="gn-sub">{row.missing ? t(row.person.role === "lead" ? "lead" : "member") : t("ownTargets")}</span>
              )}
              {row.instance?.visibility === "team" && <span className="gn-sub">{t("teamOnly")}</span>}
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
